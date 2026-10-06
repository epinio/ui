<script setup lang="ts">
import { ref, computed, watch, Ref } from 'vue';
import { useStore } from 'vuex';
import day from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useRouter } from 'vue-router';
import { formatSi } from '@shell/utils/units';
import { EPINIO_TYPES } from '../types';
import Tabs from '../components/application/Tabs.vue';
import Banner from '@components/Banner/Banner.vue';
import {
  makeStateTag,
  makeActionMenu,
  makeCommitShaCell,
  makeCommitAuthorCell,
} from '../utils/table-formatters';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';
import AppModal from '../components/application/AppModal.vue';
import ExportAppModal from '../dialog/ExportAppModal.vue';
import AppDeleteModal from '../components/application/AppDeleteModal.vue';
import { useApplication } from '../queries/useApplicationQueries';
import { toInstanceStats, toAppSourceDetails, toAppForm } from '../models/application/mappers';
import { ListResourceRequestParams, ResourceQueryOptions, ResourceTableRow } from '../models/resource/ui-types';
import { ServiceInstance } from '../models/service/ui-types';
import { ConfigurationResponse } from '../models/configuration/ui-types';
import { AppUpdateRequest } from '../models/application/ui-types';
import { GitProxyGitRepo, GitProxyGitBranch, GitProxyGitCommit } from '../models/gitproxy/ui-types';
import { debounce } from 'lodash';
import { useNamespacedServices } from '../queries/useServiceQueries';
import { useNamespacedConfigurations } from '../queries/useConfigurationQueries';
import { useUser } from '../queries/useUserQueries';
import { App, AppForm, AppPodInfo } from '../models/application/ui-types';
import { showAppShell } from '../models/application/actions/shell';
import { showAppLog, showStagingLog } from '../models/application/actions/logs';
import { restageApp, restartApp } from '../models/application/actions/restage';
import { makeNameLinks, makeEmptyCell } from '../utils/table-formatters';
import { useUpdateApplication } from '../queries/useApplicationMutations';
import { useGitConfig } from '../queries/useGitConfigQueries';
import { useGitBaseUrl, useGitProxyUserType, useGitProxyRepos, useGitProxyBranches, useGitProxyCommits } from '../queries/useGitProxyQueries';
import { useRoute } from 'vue-router';

day.extend(relativeTime);

const store = useStore();
const router = useRouter();
const route = useRoute();
const t = store.getters['i18n/t'];

// Application modals
const appModal = ref<InstanceType<typeof AppModal> | null>(null);
const exportAppModal = ref<InstanceType<typeof ExportAppModal> | null>(null);
const appDeleteModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);

// Service modals
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const serviceDeleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);

// Configuration modals
const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const configDeleteModal = ref<InstanceType<typeof ConfigurationDeleteModal> | null>(null);

// Fetch user for permissions
const { data: user, isError: isErrorUser, error: userError } = useUser(store);

// Fetch application details
const appRequestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: false,
  isTablePagination: false,
});
const { data: application, isLoading: isApplicationLoading, isError: isApplicationError, error: applicationError, refetch: refetchApplication } = useApplication(store, route.params.namespace as string, route.params.id as string, appRequestOptions);

// Convert app to form data for easy access
const appFormData = computed<AppForm | null>(() => {
  if (!application.value) {
    return null;
  }
  return toAppForm(application.value);
});

// Tab configuration
const activeDeploymentTab = ref<string | number>('overview');
const deploymentTabs = computed(() => [
  {
    id: 'overview',
    label: t('epinio.applications.detail.tables.overview'),
    completed: false,
    valid: true,
    disabled: false,
    visible: true
  },
  {
    id: 'gitCommits',
    label: t('epinio.applications.detail.tables.gitCommits'),
    completed: false,
    valid: true,
    disabled: false,
    visible: !!application.value?.origin.git?.revision,
  }
])
const activeResourceTab = ref<string | number>('instances');
const resourceTabs = ref([
  {
    id: 'instances',
    label: t('epinio.applications.detail.tables.instances'),
    completed: false,
    valid: true,
    disabled: false,
    visible: true,
  },
  {
    id: 'services',
    label: t('epinio.applications.detail.tables.services'),
    completed: false,
    valid: true,
    disabled: false,
    visible: true,
  },
  {
    id: 'configs',
    label: t('epinio.applications.detail.tables.configs'),
    completed: false,
    valid: true,
    disabled: false,
    visible: true,
  }
]);

// Fetch services for table
const servicesRequestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  app: route.params.id as string,
});
const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
  isTablePagination: true,
});
const servicesSearchQuery = ref<string>('');
watch(servicesSearchQuery, (newQuery) => {
  onServicesSearch(newQuery);
});
const onServicesSearch = debounce(async (query: string) => {
  servicesRequestParams.value.page = 1;
  servicesRequestParams.value.search = query;
}, 500);
const {data: services, isLoading: isLoadingServices, isError: isErrorServices, error: servicesError} = useNamespacedServices(store, route.params.namespace as string, servicesRequestParams, requestOptions);

// Fetch configurations for table
const configurationsRequestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  app: route.params.id as string,
});
const configurationsSearchQuery = ref<string>('');
watch(configurationsSearchQuery, (newQuery) => {
  onConfigurationsSearch(newQuery);
});
const onConfigurationsSearch = debounce(async (query: string) => {
  configurationsRequestParams.value.page = 1;
  configurationsRequestParams.value.search = query;
}, 500);
const {data: configurations, isLoading: isLoadingConfigurations, isError: isErrorConfigurations, error: configurationsError} = useNamespacedConfigurations(store, route.params.namespace as string, configurationsRequestParams, requestOptions);

// Update app mutation for increasing/decreasing instances
const { mutateAsync: updateApp, isPending: isUpdatingApp } = useUpdateApplication(store, () => refetchApplication());

// Permissions for various app actions
const canEditApp = computed(() => {
  return user.value?.permissions?.app_update || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canDeleteApp = computed(() => {
  return user.value?.permissions?.app_delete || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExportApp = computed(() => {
  return user.value?.permissions?.app_export || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExecApp = computed(() => {
  return user.value?.permissions?.app_exec  || user.value?.permissions?.app;
});
const canLogsApp = computed(() => {
  return user.value?.permissions?.app_logs || user.value?.permissions?.app;
});
const canStageApp = computed(() => {
  return user.value?.permissions?.app_stage || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canRestartApp = computed(() => {
  return user.value?.permissions?.app_restart || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canScaleApp = computed(() => {
  return user.value?.permissions?.app_scale || user.value?.permissions?.app_write || user.value?.permissions?.app;
});

// Application actions for display in the top right action menu
const openEditAppModal = (app: App) => {
  appModal.value?.openEdit(app);
};
const openDeleteAppModal = (app: App) => {
  appDeleteModal.value?.openDelete(app);
};
const appAvailableActions = computed(() => {
  if (!application.value) return [];
  return [{
    label: 'App Shell',
    action: () => showAppShell(store, application.value),
    enabled: canExecApp.value && application.value.status === 'running',
    visible: canExecApp.value,
  }, {
    label: 'App Logs',
    action: () => showAppLog(store, application.value),
    enabled: canLogsApp.value && (application.value.status === 'running' || application.value.status === 'error'),
    visible: canLogsApp.value,
  }, {
    label: 'Last Build Logs',
    action: () => showStagingLog(store, application.value),
    enabled: canLogsApp.value && !!application.value.stageId,
    visible: canLogsApp.value,
  }, {
    label: 'Export',
    action: () => exportAppModal.value?.openExport(application.value),
    enabled: canExportApp.value && application.value.status === 'running',
    visible: canExportApp.value,
  }, {
    label: 'Restage',
    action: () => restageApp(store, application.value),
    enabled: canStageApp.value && application.value.canRetryBuild,
    visible: canStageApp.value,
  }, {
    label: 'Restart',
    action: () => restartApp(store, application.value),
    enabled: canRestartApp.value && application.value.status === 'running',
    visible: canRestartApp.value,
  }, {
    label: 'Edit',
    action: () => openEditAppModal(application.value),
    enabled: canEditApp.value,
    visible: canEditApp.value,
  }, {
    label: 'Delete',
    action: () => openDeleteAppModal(application.value),
    enabled: canDeleteApp.value,
    visible: canDeleteApp.value,
    danger: true,
  }];
});

// Columns for the instances table
const instanceColumns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'name',
    label: 'Name',
    formatter: (_v: any, row: AppPodInfo) => {
      const nameText = document.createElement('p');
      nameText.textContent = row.name;
      nameText.style.whiteSpace = 'normal';
      nameText.style.wordBreak = 'break-word';
      return nameText;
    }
  },
  {
    field: 'millicpus',
    label: 'Mill CPUs',
    formatter: (value: unknown, row: AppPodInfo) => formatMetricValue(value, row)
  },
  {
    field: 'memoryBytes',
    label: 'RAM',
    formatter: (value: unknown, row: AppPodInfo) => {
      if (row.metricsOk === false) {
        return t('epinio.intro.metrics.notAvailableShort');
      }

      return formatSi(value, { suffix: 'iB', firstSuffix: 'B', increment: 1024 });
    }
  },
  {
    field: 'restarts',
    label: 'Restarts'
  },
  {
    field: 'createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

const instanceRows = computed(() => {
  if (!application.value?.deployment?.replicas) {
    return [];
  }

  return (Object.values(application.value.deployment.replicas)).map((i) => ({
    ...i,
    status: i.ready ? 'ready' : 'not-ready',
    stateDisplay: i.ready ? 'Ready' : 'Not Ready'
  }));
});

// Columns for the services table
const serviceColumns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: ServiceInstance) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    formatter: (_v: any, row: ServiceInstance) => {
      const el = document.createElement('a');

      el.textContent = row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        serviceModal.value?.openView(row);
      });

      return el;
    }
  },
  {
    field: 'catalogService',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: ServiceInstance) => makeNameLinks(
      [row.catalogService],
      { cluster: store.getters['clusterId'], resource: EPINIO_TYPES.CATALOG_SERVICE },
      router
    )
  },
  {
    field: 'catalogServiceVersion',
    label: 'Catalog Service Version'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

// Service actions and display logic
const canEditService = computed(() => {
  return user.value?.permissions?.service_write || user.value?.permissions?.service;
});
const canDeleteService = canEditService;
const openDeleteServiceModal = (service: ServiceInstance) => {
  serviceDeleteModal.value?.openDelete(service);
};
const openEditServiceModal = (service: ServiceInstance) => {
  serviceModal.value?.openEdit(service);
};
const displayServiceRows = computed(() => {
  if (!services.value) {
    return [];
  }
  
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow<ServiceInstance>[] = (services.value.items ?? []).map((s) => ({
    ...s,
    id: s.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteServiceModal(s),
      enabled: canDeleteService.value,
      visible: canDeleteService.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditServiceModal(s),
      enabled: canEditService.value,
      visible: canEditService.value,
    }],
    canDelete: canDeleteService.value,
  }));
  return rows;
});

// Columns for the configurations table
const configurationColumns = [
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '200px',
    formatter: (_v: any, row: ConfigurationResponse) => {
      const el = document.createElement('a');

      el.textContent = row.meta?.name || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        configModal.value?.openView(row);
      });

      return el;
    }
  },
  {
    field: 'configuration.origin',
    label: 'Service',
    width: '150px',
    sortable: false,
  },
  {
    field: 'configuration.variableCount',
    label: 'No. of Variables',
    width: '150px'
  },
  {
    field: 'configuration.user',
    label: 'Created By',
    width: '150px',
    formatter: (_v: any, row: ConfigurationResponse) => row.configuration?.user || makeEmptyCell()
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    width: '50px',
    formatter: 'age'
  }
];

// Configuration actions and display logic
const canEditConfiguration = computed(() => {
  return user.value?.permissions?.service_write || user.value?.permissions?.service;
});
const canDeleteConfiguration = canEditConfiguration;
const openDeleteConfigurationModal = (configuration: ConfigurationResponse) => {
  configDeleteModal.value?.openDelete(configuration);
};
const openEditConfigurationModal = (configuration: ConfigurationResponse) => {
  configModal.value?.openEdit(configuration);
};
const displayConfigurationRows = computed(() => {
  if (!configurations.value) {
    return [];
  }
  
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow<ConfigurationResponse>[] = (configurations.value.items ?? []).map((c) => ({
    ...c,
    id: c.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteConfigurationModal(c),
      enabled: canDeleteConfiguration.value,
      visible: canDeleteConfiguration.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditConfigurationModal(c),
      enabled: canEditConfiguration.value && !c.configuration.origin,
      visible: canEditConfiguration.value && !c.configuration.origin,
    }],
    canDelete: canDeleteConfiguration.value,
  }));
  return rows;
});

// Data handling for instance metrics
const showMetricsUnavailable = computed(() => {
  const replicas = application.value?.deployment?.replicas ?? {};
  const hasReplicas = Object.keys(replicas).length > 0;
  const allReplicasMetricsOk = hasReplicas ? 
    Object.values(replicas).every((r) => r.metricsOk) : false;
  return !allReplicasMetricsOk;
});
function formatMetricValue(value: unknown, row: { metricsOk?: boolean }) {
  if (row.metricsOk === false) {
    return t('epinio.intro.metrics.notAvailableShort');
  }

  return value;
}
const instanceMemory = computed(() => {
    const stats = toInstanceStats(Object.values(application.value?.deployment?.replicas ?? {}), 'memoryBytes');
    const opts = {
      suffix:      'iB',
      firstSuffix: 'B',
      increment:   1024,
    };

    return {
      min: formatSi(stats.min, opts),
      max: formatSi(stats.max, opts),
      avg: formatSi(stats.avg, opts),
    };;
});
const instanceCpu = computed(() => {
  return toInstanceStats(Object.values(application.value?.deployment?.replicas ?? {}), 'millicpus');
});

// When the application data is loaded set the initial desired instances
watch(application, (newApp) => {
  desiredInstances.value = newApp?.deployment?.desiredReplicas ?? 0;
});
const desiredInstances = ref<number>(application?.value?.deployment?.desiredReplicas ?? 0);

// Watch for changes in the desired instances and trigger the update handler
watch(desiredInstances, (newValue) => {
  onInstancesChange(newValue);
});

// Debounced handler for updating the desired instances
const onInstancesChange = debounce(async (newInstances: number) => {
  if (!application.value) {
    return;
  }

  // If the new instance count matches the current desired replicas, no update is needed
  if (newInstances === application.value.deployment?.desiredReplicas) {
    return;
  }

  const updateRequest: AppUpdateRequest = {
    appChart: application.value.configuration.appChart,
    configurations: application.value.configuration.configurations,
    environment: application.value.configuration.environment,
    routes: application.value.configuration.routes,
    replaceEnv: true,
    restart: true,
    settings: application.value.configuration.settings || null,
    instances: newInstances
  }; 

  updateApp({namespace: application.value.meta.namespace, app: application.value.meta.name, body: updateRequest});
}, 500);

async function updateInstances(newInstances: number) {
  desiredInstances.value = newInstances;
}

const showScaleSpinner = computed(() => isUpdatingApp.value);

// Initial git values from the application form data
const sourceType = computed(() => appFormData.value?.source.type);
const gitUsername = computed(() => {
  if (!appFormData.value || !sourceType.value) {
    return '';
  }
  return appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.userOrOrg;
});
const gitConfig = computed(() => {
  if (!appFormData.value || !sourceType.value) {
    return null;
  }
  return appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.gitConfig || null;
});

// Fetch git config details if needed for use in git requests
const gitConfigRequestOptions = ref<ResourceQueryOptions>({
  enabled: !!appFormData.value && !!gitConfig.value && (sourceType.value === 'github' || sourceType.value === 'gitlab'),
  polling: false,
});
const {data: selectedGitConfig, isLoading: isLoadingGitConfig, isError: isErrorGitConfig, error: gitConfigError} = useGitConfig(store, appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.gitConfig || '', gitConfigRequestOptions);

// Compute the base URL for the selected git provider using the fetched git config
const gitBaseUrl = useGitBaseUrl(sourceType as Ref<'github' | 'gitlab'>, selectedGitConfig); 

// Git User
const gitUserRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: !!appFormData.value && !!gitBaseUrl.value && !!gitUsername.value,
  polling: false,
}));
const { data: gitUser, isLoading: isGitUserLoading, isError: isGitUserError } = useGitProxyUserType(
  store,
  sourceType as Ref<'github' | 'gitlab'>,
  gitUsername as Ref<string>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  gitUserRequestOptions,
);

// Git Repository
const gitRepo = computed(() => {
  if (!appFormData.value || !sourceType.value) {
    return '';
  }
  return appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.repository;
});
const gitRepoRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value?.username && !!gitRepo.value,
  polling: false,
}));
const { data: gitRepos, isLoading: isGitReposLoading, isError: isGitReposError } = useGitProxyRepos(
  store,
  sourceType as Ref<'github' | 'gitlab'>,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  gitRepo as Ref<string>,
  gitRepoRequestOptions,
);
const selectedRepo = computed(() => {
  return gitRepos.value?.find(repo => repo.name === gitRepo.value) || null;
});

// Git Branch
const gitBranch = computed(() => {
  if (!appFormData.value || !sourceType.value) {
    return '';
  }
  return appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.branch;
});
const gitBranchRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value && !!selectedRepo.value,
  polling: false,
}));
const { data: gitBranches, isLoading: isGitBranchesLoading, isError: isGitBranchesError } = useGitProxyBranches(
  store,
  sourceType as Ref<'github' | 'gitlab'>,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  selectedRepo as Ref<GitProxyGitRepo>,
  gitBranch as Ref<string>,
  gitBranchRequestOptions,
);
const selectedBranch = computed(() => {
  return gitBranches.value?.find(branch => branch.name === gitBranch.value) || null;
})

// Git Commit
const gitCommit = computed(() => {
  if (!appFormData.value || !sourceType.value) {
    return '';
  }
  return appFormData.value?.source[sourceType.value as 'github' | 'gitlab']?.commit;
});
const gitCommitRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value && !!selectedRepo.value && !!selectedBranch.value,
  polling: false,
}));
const { data: gitCommits, isLoading: isGitCommitsLoading, isError: isGitCommitsError } = useGitProxyCommits(
  store,
  sourceType as Ref<'github' | 'gitlab'>,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  selectedRepo as Ref<GitProxyGitRepo>,
  selectedBranch as Ref<GitProxyGitBranch>,
  gitCommitRequestOptions,
);
const selectedCommit = computed(() => {
  return gitCommits.value?.find(commit => commit.sha === gitCommit.value) || null;
});

function formatURL(str: string) {
  const matchGit = str.match('^(https|git)(:\/\/|@)([^\/:]+)[\/:]([^\/:]+)\/(.+)(.git)*$'); // eslint-disable-line no-useless-escape
  return `${matchGit?.[4]}/${matchGit?.[5]}`;
}

// Git commits table columns for display in the UI
const gitCommitsColumns = computed(() => [
  {
    field: 'sha',
    label: t(`epinio.applications.gitSource.${ sourceType.value }.tableHeaders.sha.label`),
    width: '90px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => makeCommitShaCell(
      row,
      application.value?.origin.git?.revision,
      t('epinio.applications.detail.deployment.details.git.deployed')
    )
  },
  {
    field: 'author',
    label: t(`epinio.applications.gitSource.${ sourceType.value }.tableHeaders.author.label`),
    width: '190px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => makeCommitAuthorCell(
      row,
      t(`epinio.applications.gitSource.${ sourceType.value }.tableHeaders.author.unknown`)
    )
  },
  {
    field: 'message',
    label: t(`epinio.applications.gitSource.${ sourceType.value }.tableHeaders.message.label`),
    sortable: false,
  },
  {
    field: 'date',
    label: t(`epinio.applications.gitSource.${ sourceType.value }.tableHeaders.date.label`),
    width: '220px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => {
      const span = document.createElement('span');

      if (row.date) {
        span.textContent = new Date(row.date).toLocaleString();
      }

      return span;
    }
  },
]);

// Git commit table rows for display in the UI
const gitCommitRows = computed(() => {
  if (!gitCommits.value) {
    return [];
  }
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow<GitProxyGitCommit>[] = (gitCommits.value ?? []).map((c) => ({
    ...c,
    id: c.sha, // stable, unique per namespace
    availableActions: [{
      label: 'Redeploy',
      action: () => {
        if (!application.value) {
          return;
        }
        appModal.value?.openEdit(application.value, c.commitId)
      },
      enabled: canEditApp.value && !!application.value && c.commitId !== application.value?.origin.git?.revision,
      visible: canEditApp.value && !!application.value && c.commitId !== application.value?.origin.git?.revision,
    }],
  }));
  return rows;
});


function formatDate(date: string, from: boolean) {
  return from ? day(date).fromNow() : day(date).format('DD MMM YYYY');
}

function handleDeleted() {
  // navigate back to the applications list after deletion
  store.$router.push({
    name: 'epinio-c-cluster-applications',
    params: store.$router.currentRoute.params,
  });
}

const appSourceDetails = computed(() => {
  if (!appFormData.value) {
    return null;
  }

  return toAppSourceDetails(appFormData.value, t);
});

</script>

<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<!--
  trailhand-* are Web Components, not Vue components. The HTML standard
  slot="x" attribute is correct here; eslint-plugin-vue's deprecation rule
  only applies to Vue component slots.
-->
<template>
  <div class="page-loading" v-if="isApplicationLoading">
    <trailhand-loading-spinner size="large" />
  </div>
  <div v-else-if="isApplicationError">Error loading application data: {{ applicationError?.message || 'Error fetching application data'}}</div>
  <div v-else class="content">
    <div class="heading">
      <div class="heading-row">
        <div class="title-content">
          <h1>Application: {{ application?.meta.name }}</h1>
          <p>{{ application?.stateDisplay }}</p>
        </div>
        <trailhand-action-menu
          v-if="appAvailableActions.length > 0"
          :actions="appAvailableActions"
        />
      </div>
      <h3>Namespace: {{ application?.meta.namespace }}</h3>
      <ul>
        <li
          v-for="(route, index) in application?.configuration.routes"
          :key="`${route}-${index}`"
        >
          <a
            v-if="application?.status === 'running'"
            :key="`${route}-${index}-a`"
            :href="`https://${route}`"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >{{ `https://${route}` }}</a>
          <span
            v-else
            :key="`${route}-${index}-b`"
          >{{ `https://${route}` }}</span>
        </li>
      </ul>
    </div>
    <div class="number-cards">
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ Object.keys(application?.configuration.environment || {}).length ?? 0 }}</span> {{ t('epinio.applications.detail.counts.envVars') }}</p>
        </div>
      </trailhand-card>
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ application?.configuration.services?.length ?? 0 }}</span> {{ t('epinio.applications.detail.counts.services') }}</p>
        </div>
      </trailhand-card>
      <trailhand-card class="dashboard-card" variant="info">
        <div slot="title">
          <p class="number-text"><span class="number">{{ application?.configuration.boundConfigurations?.filter(config => config.type === "custom").length ?? 0 }}</span> {{ t('epinio.applications.detail.counts.config') }}</p>
        </div>
      </trailhand-card>
    </div>

    <h3
      v-if="application?.deployment || application?.imageUrl"
      class="mt-20"
    >
      {{ t('epinio.applications.detail.deployment.label') }}
    </h3>
    <div
      v-if="application?.deployment || application?.imageUrl"
      class="deployment"
    >
      <!-- Source information -->
      <Tabs  v-model="activeDeploymentTab" :tabs="deploymentTabs" variant="underline">
        <template #overview>
          <div class="simple-box-row app-instances">
            <trailhand-card variant="info" class="dashboard-card simple-box">
              <div slot="title" class="consumption-card">
                <div class="instances">
                  <trailhand-progress-bar label="Instances" :value="application?.deployment?.readyReplicas" :total="desiredInstances"></trailhand-progress-bar>
                  <div class="instances-controls">
                    <trailhand-button v-if="canScaleApp" variant="secondary" size="small" :disabled="isUpdatingApp || desiredInstances <= 0" @button-click="updateInstances(desiredInstances - 1)">
                      <trailhand-icon name="minus" />
                    </trailhand-button>
                    <div
                      v-if="showScaleSpinner"
                      class="scale-instances__spinner mt-5"
                    >
                      <i class="icon-spinner animate-spin" />
                    </div>
                    <trailhand-button v-if="canScaleApp" variant="secondary" size="small" :disabled="isUpdatingApp" @button-click="updateInstances(desiredInstances + 1)">
                      <trailhand-icon name="plus" />
                    </trailhand-button>
                  </div>
                </div>
                <div class="deployment__origin__row">
                  <Banner
                    v-if="showMetricsUnavailable"
                    color="warning"
                    class="metrics-unavailable"
                  >
                    {{ t('epinio.intro.metrics.notAvailable') }}
                  </Banner>
                  <div
                    v-else
                    class="stats-table"
                  >
                    <table class="mt-15">
                      <thead>
                        <tr>
                          <th />
                          <th>Min</th>
                          <th>Max</th>
                          <th>Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td>{{ t('tableHeaders.memory') }}</td>
                              <td>{{ instanceMemory.min }}</td>
                              <td>{{ instanceMemory.max }}</td>
                              <td>{{ instanceMemory.avg }}</td>
                          </tr>
                          <tr>
                              <td>{{ t('tableHeaders.cpu') }}</td>
                              <td>{{ instanceCpu.min }}</td>
                              <td>{{ instanceCpu.max }}</td>
                              <td>{{ instanceCpu.avg }}</td>
                          </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </trailhand-card>
            <trailhand-card v-if="appSourceDetails" variant="info" class="dashboard-card simple-box">
              <div slot="title" class="deployment__origin__list" >
                <table>
                  <tbody>
                    <tr>
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.origin') }}
                      </td>
                      <td class="origin-value">
                        {{ appSourceDetails.label }}
                      </td>
                    </tr>
                    <tr v-for="d of appSourceDetails.details" :key="d.label">
                      <td class="origin-prop">{{ d.label }}</td>
                      <td v-if="d.value && d.value.startsWith('http')" class="origin-value">
                        <a
                          :href="d.value"
                          target="_blank"
                          class="origin-link"
                        >{{ formatURL(d.value) }}</a>
                      </td>
                      <td v-else-if="selectedCommit && d.value && d.value.match(/^[a-f0-9]{40}$/)" class="origin-value">
                        <a
                          :href="`${selectedCommit.htmlUrl}/commit/${d.value}`"
                          target="_blank"
                          class="origin-link"
                        >{{ d.value }}</a>
                      </td>
                      <td v-else class="origin-value">{{ d.value }}</td>
                    </tr>
                    <tr v-if="selectedRepo && selectedRepo.createdAt">
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.git.created') }}
                      </td>
                      <td class="origin-value">
                        {{ formatDate(selectedRepo.createdAt, false) }}
                      </td>
                    </tr>
                    <tr v-if="selectedRepo && (selectedRepo.updatedAt || selectedRepo.lastActivityAt)">
                      <td class="origin-prop">
                        {{ t('epinio.applications.detail.deployment.details.git.updated') }}
                      </td>
                      <td class="origin-value">
                        {{ formatDate(selectedRepo.updatedAt || selectedRepo.lastActivityAt || '', true) }}
                      </td>
                    </tr>
                    <tr>
                      <td class="origin-prop">
                        {{ t('epinio.applications.tableHeaders.deployedBy') }}
                      </td>
                      <td class="origin-value">
                        {{ application.deployment?.username }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </trailhand-card>
          </div>
        </template>
        <template #gitCommits>
          <Banner
            color="info"
            class="redeploy-info"
          >
            {{ t('epinio.applications.detail.deployment.commits.redeploy') }}
          </Banner>
          <trailhand-table
            v-if="gitCommits && gitCommits.length"
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :rows="gitCommitRows"
            :columns="gitCommitsColumns"
            key-field="sha"
            :searchable="true"
            :paginated="true"
            :rows-per-page="10"
          />
        </template>
      </Tabs>
    </div>

    <h3 class="mt-20">
      {{ t('epinio.applications.detail.tables.label') }}
    </h3>

    <div>
      <Tabs v-model="activeResourceTab" :tabs="resourceTabs" variant="underline">
        <template #instances>
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :columns="instanceColumns"
            :rows="instanceRows"
            :searchable="false"
            :paginated="false"
          />
        </template>
        <template #services>
          <div class="search-container">
            <trailhand-text-input
              :value="servicesSearchQuery"
              placeholder="Search..."
              @text-input-change="(e: CustomEvent) => servicesSearchQuery = e.detail.value"
            ></trailhand-text-input>
          </div>
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :rows="displayServiceRows"
            :columns="serviceColumns"
            :searchable="false"
            :server-side="true"
            :total-items="services?.totalItems ?? 0"
            :current-page="servicesRequestParams.page"
            :loading="isLoadingServices"
            key-field="id"
            @page-change="(e: CustomEvent) => { servicesRequestParams.page = e.detail.page; }"
          />
        </template>
        <template #configs>
          <div class="search-container">
            <trailhand-text-input
              :value="configurationsSearchQuery"
              placeholder="Search..."
              @text-input-change="(e: CustomEvent) => configurationsSearchQuery = e.detail.value"
            ></trailhand-text-input>
          </div>
          <trailhand-table
            :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
            :rows="displayConfigurationRows"
            :columns="configurationColumns"
            :searchable="false"
            :server-side="true"
            :total-items="configurations?.totalItems ?? 0"
            :current-page="configurationsRequestParams.page"
            :loading="isLoadingConfigurations"
            key-field="id"
            @page-change="(e: CustomEvent) => { configurationsRequestParams.page = e.detail.page; }"
          />
        </template>
      </Tabs>
    </div>
  </div>
  <ServiceInstanceModal ref="serviceModal" />
  <ServiceDeleteModal ref="serviceDeleteModal" />
  <ConfigurationModal ref="configModal" />
  <ConfigurationDeleteModal ref="configDeleteModal" />
  <AppModal ref="appModal" />
  <ExportAppModal ref="exportAppModal" />
  <AppDeleteModal ref="appDeleteModal" @deleted="handleDeleted" />
</template>

<style lang="scss" scoped>
.page-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.heading {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .heading-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title-content {
      display: flex;
      align-items: flex-end;
      gap: 10px;

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        color: var(--th-color-text-primary);
      }

      p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--th-color-primary);
      }
    }

    trailhand-action-menu {
      --sortable-table-row-hover-bg: var(--sortable-table-hover-bg)
    }
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 400;
    color: var(--th-color-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    display: flex;
    gap: 10px;

    li {
      list-style: none;
      font-size: 14px;

      a {
        color: var(--th-color-link);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.number-cards {
  display: flex;
  gap: 8px;
  margin-top: 20px;

  trailhand-card::part(body) {
    display: none;
  }

  trailhand-card::part(action) {
    display: none;
  }

  .dashboard-card {
    .number-text {
      font-size: 14px;
      color: var(--th-color-text-secondary);
      font-weight: 400;
    }

    .number {
      font-size: 24px;
      font-weight: 600;
      color: var(--th-color-text-primary);
    }
  }
}

.instances {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .instances-controls {
    display: flex;
    justify-content: space-between;
  }
}

.content {
  max-width: 1600px;
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

.search-container {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.simple-box-row {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-gap: 10px;

  @media only screen and (max-width: map-get($breakpoints, '--viewport-9')) {
    grid-auto-flow: row;
  }
  .simple-box {
    width: 100%;
    ul {
      word-break: break-all;
    }
    &:not(:last-of-type) {
      margin-right: 20px;
    }
    .deployment__origin__row {
      display: flex;
      flex-direction: column;
      h4:first-of-type {
        font-weight: bold;
        margin-bottom: 0;
      }
      h4:last-of-type {
        word-break: break-all;
      }
      &:last-of-type {
        h4:last-of-type {
          margin-bottom: 0;
        }
      }
      thead {
        tr {
          th {
            text-align: left;
            color: var(--muted);
            font-weight: 300;
          }
        }
      }
    }

    .scale-instances {
      display: flex;
      align-items: center;

      .plus-minus {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
  .box {
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    & h1,
    h3 {
      margin-left: 5;
    }
    h3 {
      flex: 1;
      display: flex;
    }
    &-two-cols {
      display: flex;
      h1 {
        font-size: 4.5rem;
        padding: 0 10px;
      }
      div {
        margin-top: 8px;
      }
    }
    &-timers {
      display: flex;
      flex-direction: column;
      h4 {
        font-size: 1.6rem;
      }
      div {
        width: 100%;
        display: flex;
        justify-content: space-between;
      }
    }
  }
}

.stats-table {
  display: flex;
  width: 100%;

  table {
    width: 100%;
  }
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 12px 0;
  position: relative;

  & > div:nth-child(2) {
    display: flex;
    flex-direction: column;
    // align-items: flex-end;
  }

  h3 {
    font-size: 18px;
    font-weight: 500;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;

    li {
      list-style: none;
      font-size: 16px;
      font-weight: 500;

      span {
        font-size: 12px;
        font-weight: 600;
        color: var(--th-color-text-secondary);
      }
    }
  }

  // For the second div in stats, style the ul differently
  & > div:nth-child(2) ul {
    // align-items: flex-end;
  }

}

.deployment__details__header {
  display: flex;
  align-items: center;
  h4 {
    margin: 0
  }
  .git-icon {
    margin: 0 3px 0 -3px;
    font-size: 25px;
  }
}

.scale-instances__spinner {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--muted-text);
}

.deployment__origin__list {
  table {
    width: 100%;
    border-collapse: collapse;

    td {
      padding: 8px 4px;

      &.origin-prop {
        font-size: 12px;
        color: var(--th-color-text-secondary);
        font-weight: 600;
      }

      &.origin-value {
        font-size: 16px;
        color: var(--th-color-text-primary);
        font-weight: 500;
      }
    }
  }

  .origin-link {
    color: var(--th-color-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.sortable-table {
  &-avatar {
    display: flex;
    align-items: center;
    justify-content: flex-start;

    img {
      width: 30px;
      height: 30px;
      border-radius: var(--border-radius);
      margin-right: 10px;
    }
  }

  &-commit {
    display: flex;
  }
}

.redeploy-info {
  margin: 0;
}

.live-date{
  color: red !important;
}

:deep(.spaced-row.metadata) {
  display: none !important;
}
</style>
