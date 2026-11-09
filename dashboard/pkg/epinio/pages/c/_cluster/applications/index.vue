<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { debounce } from 'lodash';
import Banner from '@components/Banner/Banner.vue';
import { EPINIO_TYPES } from '../../../../types';
import Masthead from '@shell/components/ResourceList/Masthead';
import {
  makeActionMenu,
  makeStateTag,
  makeAppRoutesCell,
  makeNameLinks,
  makeTruncatedTextCell,
} from '../../../../utils/table-formatters';
import AppModal from '../../../../components/application/AppModal.vue';
import AppDeleteModal from '../../../../components/application/AppDeleteModal.vue';
import BulkDeleteModal from '../../../../components/BulkDeleteModal.vue';
import ExportAppModal from '../../../../dialog/ExportAppModal.vue';
import { useApplications } from '../../../../queries/useApplicationQueries';
import { useBulkRemoveApplications } from '../../../../queries/useApplicationMutations';
import { App, AppListMode } from '../../../../models/application/ui-types';
import { ListResourceRequestParams, ResourceQueryOptions, ResourceTableRow } from '../../../../models/resource/ui-types';
import { useUser } from '../../../../queries/useUserQueries';
import { showAppShell } from '../../../../models/application/actions/shell';
import { showAppLog, showStagingLog } from '../../../../models/application/actions/logs';
import { restageApp, restartApp, deployBuiltApp, deleteAppBuild } from '../../../../models/application/actions/restage';
import ServiceInstanceModal from '../../../../components/service/ServiceInstanceModal.vue';
import ConfigurationModal from '../../../../components/configuration/ConfigurationModal.vue';
import { fetchConfiguration } from '../../../../queries/useConfigurationQueries';
import { fetchService } from '../../../../queries/useServiceQueries';
import { appCanDeployBuild, appCanDeleteBuild } from '../../../../utils/application';
import { patchTrailhandServerSort, useServerTableSort, withServerSideSort } from '../../../../utils/server-table-sort';

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = store.$router;

const appModal = ref<InstanceType<typeof AppModal> | null>(null);
const deleteModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const exportAppModal = ref<InstanceType<typeof ExportAppModal> | null>(null);
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);

const resource: string = EPINIO_TYPES.APP;

const { data: user, isError: isErrorUser, error: userError } = useUser(store);

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  namespaces: []
});

const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
  isTablePagination: true,
});

const listMode = ref<AppListMode>('deployed');

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: applications, isLoading: isLoadingApplications, isError: isErrorApplications, error: applicationsError} = useApplications(store, requestParams, requestOptions, listMode);
const { mutateAsync: bulkRemove } = useBulkRemoveApplications(store);

const tableEl = ref<any>(null);

const selectedRows = ref<any[]>([]);

const setListMode = (next: AppListMode) => {
  if (listMode.value === next) {
    return;
  }

  listMode.value = next;
  requestParams.value = {
    ...requestParams.value,
    page: 1,
    sort: undefined,
    sortDir: undefined,
  };
  selectedRows.value = [];
  tableEl.value?.clearSelection();
  tableEl.value?.resetSort?.();
};

const canCreate = computed(() => {
  return user.value?.permissions?.app_create || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canEdit = computed(() => {
  return user.value?.permissions?.app_update || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canDelete = computed(() => {
  return user.value?.permissions?.app_delete || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExport = computed(() => {
  return user.value?.permissions?.app_export || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canExec = computed(() => {
  return user.value?.permissions?.app_exec  || user.value?.permissions?.app;
});
const canLogs = computed(() => {
  return user.value?.permissions?.app_logs || user.value?.permissions?.app;
});
const canStage = computed(() => {
  return user.value?.permissions?.app_stage || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canRestart = computed(() => {
  return user.value?.permissions?.app_restart || user.value?.permissions?.app_write || user.value?.permissions?.app;
});
const canDeploy = computed(() => {
  return user.value?.permissions?.app_deploy || user.value?.permissions?.app_write || user.value?.permissions?.app;
});

const handleCreateClick = () => {
  appModal.value?.openCreate();
};

// Watch for changes to the active namespace cache and update the request params accordingly
watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  if (activeNamespaces && Object.keys(activeNamespaces).length > 0) {
    requestParams.value.namespaces = Object.keys(activeNamespaces);
  } else {
    requestParams.value.namespaces = undefined;
  }
});

const openDeleteModal = (app: App) => {
  deleteModal.value?.openDelete(app);
};

const openEditModal = (app: App) => {
  appModal.value?.openEdit(app);
};

const displayRows = computed(() => {
  if (!applications.value) {
    return [];
  }
  
  const rows: ResourceTableRow<App>[] = (applications.value.items ?? []).map((a) => ({
    ...a,
    id: a.meta.name, // stable, unique per namespace
    availableActions: [{
      label: t('epinio.applications.actions.shell.label'),
      action: () => showAppShell(store, a),
      enabled: canExec.value && a.status === 'running',
      visible: canExec.value,
    }, {
      label: t('epinio.applications.actions.viewAppLogs.label'),
      action: () => showAppLog(store, a),
      enabled: canLogs.value && (a.status === 'running' || a.status === 'error'),
      visible: canLogs.value,
    }, {
      label: t('epinio.applications.actions.viewStagingLogs.label'),
      action: () => showStagingLog(store, a),
      enabled: canLogs.value && !!a.stageId,
      visible: canLogs.value,
    }, {
      label: 'Export',
      action: () => exportAppModal.value?.openExport(a),
      enabled: canExport.value && a.status === 'running',
      visible: canExport.value,
    }, {
      label: t('epinio.applications.actions.restage.label'),
      action: () => restageApp(store, a),
      enabled: canStage.value && a.canRetryBuild && a.status !== 'staging',
      visible: canStage.value,
    }, {
      label: t('epinio.applications.actions.deployBuild.label'),
      action: () => deployBuiltApp(store, a),
      enabled: canDeploy.value && appCanDeployBuild(a),
      visible: canDeploy.value && appCanDeployBuild(a),
    }, {
      label: t('epinio.applications.actions.restart.label'),
      action: () => restartApp(store, a),
      enabled: canRestart.value && a.status === 'running' && !!a.imageUrl,
      visible: canRestart.value && a.status === 'running' && !!a.imageUrl,
    }, {
      label: 'Edit',
      action: () => openEditModal(a),
      enabled: canEdit.value,
      visible: canEdit.value,
    }, {
      label: t('epinio.applications.actions.deleteBuild.label'),
      action: () => deleteAppBuild(store, a),
      enabled: canDelete.value && appCanDeleteBuild(a),
      visible: canDelete.value && appCanDeleteBuild(a),
      danger: true,
    }, {
      label: 'Delete',
      action: () => openDeleteModal(a),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

onMounted(async () => {
  window.addEventListener('resize', onResize);

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    appModal.value?.openCreate();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

const openServiceModal = async (namespace: string, service: string) => {
  if (!namespace || !service) {
    return;
  }
  const serviceInstance = await fetchService(store, namespace, service);
  serviceModal.value?.openView(serviceInstance);
};

const openConfigurationModal = async (namespace: string, configName: string) => {
  if (!namespace || !configName) {
    return;
  }
  const configuration = await fetchConfiguration(store, namespace, configName);
  configModal.value?.openView(configuration);
};

// Services without service_write/service permission on that row can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.canDelete;

const handleSelectionChange = (event: CustomEvent) => {
  selectedRows.value = event.detail.selectedRows;
};

const handleBulkDeleteClick = () => {
  bulkDeleteModal.value?.openDelete(selectedRows.value);
};

const handleBulkDelete = async (items: App[], deleteImage: boolean, deletePVC: boolean) => {
  await bulkRemove({items, settings: {deleteImage, deletePVC, unmounted: true}});
};

const handleBulkDeleted = () => {
  selectedRows.value = [];
  tableEl.value?.clearSelection();
};

// NOTE: must be a named function declared here, not an inline arrow function
// in the template, see feedback_vue_ref_unwrap_bug.md. Vue auto-unwraps
// top-level refs inside template expressions, so referencing `tableEl`
// directly in an inline template callback gives the already-unwrapped
// (initially null) value instead of the Ref object, and `tableEl.value = el`
// throws, silently aborting the rest of the block.
const setTableRef = (el: any) => {
  if (el) {
    tableEl.value = el;
    el.renderActions = (row: any) => makeActionMenu(row, listMode.value);
    el.rowSelectable = isRowSelectable;
    // Patch immediately on mount — click-listener approach missed sort params.
    patchTrailhandServerSort(el, requestParams);
  }
};

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

const boundConfigsColumn = {
  field:     'boundConfigs',
  label:     'Bound Configs',
  width:     '180px',
  sortable:  false,
  formatter: (_value: any, row: App) => {
    const configs = row.configuration.configurations || [];
    const span = document.createElement('span');

    span.style.whiteSpace = 'normal';
    span.style.overflowWrap = 'anywhere';
    span.style.wordBreak = 'break-word';

    configs.forEach((config, index) => {
      const a = document.createElement('a');

      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openConfigurationModal(row.meta.namespace, config);
      });
      a.textContent = config;
      span.appendChild(a);

      if (index < configs.length - 1) {
        span.appendChild(document.createTextNode(', '));
      }
    });

    return span;
  }
};

const boundServicesColumn = {
  field:     'boundServices',
  label:     'Bound Services',
  width:     '180px',
  sortable:  false,
  formatter: (_value: any, row: App) => {
    const services = row.configuration.services || [];
    const span = document.createElement('span');

    span.style.whiteSpace = 'normal';
    span.style.overflowWrap = 'anywhere';
    span.style.wordBreak = 'break-word';

    services.forEach((service, index) => {
      const a = document.createElement('a');

      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openServiceModal(row.meta.namespace, service);
      });
      a.textContent = service;
      span.appendChild(a);

      if (index < services.length - 1) {
        span.appendChild(document.createTextNode(', '));
      }
    });

    return span;
  }
};

const baseColumns = [
  {
    field:     'stateDisplay',
    label:     'State',
    width:     '110px',
    formatter: (_value: string, row: App) => makeStateTag(row)
  },
  {
    // Use meta.name (not nameDisplay) so sort keys resolve to a real string.
    field: 'meta.name',
    label: 'Name',
    width: '125px',
    formatter: (_value: any, row: App) => makeNameLinks(
      [row.meta.name],
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.APP },
      router
    )
  },
  {
    field: 'meta.namespace',
    label: 'Namespace',
    width: '125px',
  },
];

const deployedColumns = [
  ...baseColumns,
  { field: 'deployment.status', label: 'Status', width: '75px' },
  {
    field:     'route',
    label:     'Routes',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: App) => makeAppRoutesCell(row)
  },
  boundConfigsColumn,
  boundServicesColumn,
  { field: 'deployment.username', label: 'Last Deployed By', width: '150px' },
  { field: 'meta.createdAt',      label: 'Age',              width: '50px', formatter: 'age' }
];

const undeployedColumns = [
  ...baseColumns,
  {
    field: 'buildStatus',
    label: t('epinio.applications.tableHeaders.buildStatus'),
    width: '110px',
  },
  {
    field: 'builtImageUrl',
    label: t('epinio.applications.tableHeaders.builtImage'),
    width: '220px',
    formatter: (value: string) => makeTruncatedTextCell(value || '', '220px'),
  },
  { field: 'meta.createdAt', label: 'Age', width: '50px', formatter: 'age' }
];

const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();
  const cols = listMode.value === 'undeployed' ? undeployedColumns : deployedColumns;

  if (listMode.value === 'deployed') {
    if (w < 1900) hide.add('deployment.username');
    if (w < 1700) hide.add('deployment.status');
    if (w < 1600) { hide.add('boundConfigs'); hide.add('boundServices'); }
    if (w < 875)  hide.add('route');
  } else if (w < 1200) {
    hide.add('builtImageUrl');
  }

  if (w < 1150) hide.add('meta.createdAt');

  return withServerSideSort(cols.filter(col => !hide.has(col.field)));
});

useServerTableSort(requestParams, tableEl, columns);
</script>

<template>
  <div id="modal-container-element">
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #extraActions>
        <trailhand-button
          v-if="selectedRows.length"
          variant="destructive"
          size="large"
          @click="handleBulkDeleteClick"
        >
          <trailhand-icon name="trash" />
          Delete ({{ selectedRows.length }})
        </trailhand-button>
      </template>
      <template #createButton>
        <trailhand-button
          v-if="canCreate"
          variant="primary"
          size="large"
          @click="handleCreateClick"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else />
      </template>
    </Masthead>
    <Banner
      v-if="isErrorUser"
      color="error"
      :label="userError?.message || t('epinio.user.errors.fetch')"
    />
    <Banner
      v-if="isErrorApplications"
      color="error"
      :label="applicationsError?.message || t('epinio.applications.errors.fetch')"
    />  
    <div class="list-toolbar">
      <div
        class="list-mode-switch"
        role="group"
        :aria-label="t('epinio.applications.listMode.label')"
      >
        <button
          type="button"
          class="list-mode-switch__btn"
          :class="{ 'is-active': listMode === 'deployed' }"
          :aria-pressed="listMode === 'deployed'"
          @click="setListMode('deployed')"
        >
          {{ t('epinio.applications.listMode.deployed') }}
        </button>
        <button
          type="button"
          class="list-mode-switch__btn"
          :class="{ 'is-active': listMode === 'undeployed' }"
          :aria-pressed="listMode === 'undeployed'"
          @click="setListMode('undeployed')"
        >
          {{ t('epinio.applications.listMode.undeployed') }}
        </button>
      </div>
      <trailhand-text-input
        :value="searchQuery"
        placeholder="Search..."
        @text-input-change="(e: CustomEvent) => searchQuery = e.detail.value"
      ></trailhand-text-input>
    </div>
      <trailhand-table
        :ref="setTableRef"
        :rows="displayRows"
        :columns="columns"
        :searchable="false"
        :selectable="canDelete"
        :server-side="true"
        :total-items="applications?.totalItems ?? 0"
        :current-page="requestParams.page"
        :loading="isLoadingApplications"
        key-field="id"
        @navigate="handleNavigate"
        @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
        @selection-change="handleSelectionChange"
      />
    <AppModal ref="appModal" />
    <AppDeleteModal ref="deleteModal" />
    <ExportAppModal ref="exportAppModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="application"
      :resource-type="resource"
      :is-deleting-apps="true"
      :bulk-remove="handleBulkDelete"
      @settled="handleBulkDeleted"
    />
    <ConfigurationModal ref="configModal" />
    <ServiceInstanceModal ref="serviceModal" />
  </div>
</template>

<style lang="scss" scoped>

.list-toolbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;

  trailhand-text-input {
    max-width: 280px;
    margin-left: auto;
  }
}

.list-mode-switch {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  overflow: hidden;
  background: var(--input-bg, var(--body-bg));
}

.list-mode-switch__btn {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 0.4rem 0.9rem;
  background: transparent;
  color: var(--body-text);
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.2;
  cursor: pointer;

  & + & {
    border-left: 1px solid var(--border);
  }

  &.is-active {
    background: var(--primary);
    color: var(--primary-text, #fff);
  }

  &:focus-visible {
    outline: 2px solid var(--outline);
    outline-offset: -2px;
  }
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 500px;
  max-width: 100%;
}

</style>
