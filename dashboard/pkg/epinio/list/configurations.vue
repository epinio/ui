<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeEmptyCell, makeNameLinks, makeActionMenu } from '../utils/table-formatters';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';
import { debounce } from 'lodash';
import { useConfigurations } from '../queries/useConfigurationQueries';
import { ListResourceRequestParams, ResourceQueryOptions } from '../models/resource/ui-types';
import { ResourceTableRow } from '../models/resource/ui-types';
import { ConfigurationResponse } from '../models/configuration/ui-types';
import { useBulkRemoveConfigurations, useUnbindConfiguration } from '../queries/useConfigurationMutations';
import { fetchService } from '../queries/useServiceQueries';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import Banner from '@components/Banner/Banner.vue';
import { useUser } from '../queries/useUserQueries';

const store = useStore();
const router = useRouter();

defineProps<{ schema: object }>(); // Keep for compatibility

const resource: string = EPINIO_TYPES.CONFIGURATION;

const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ConfigurationDeleteModal> | null>(null);
const serviceInstanceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const tableEl = ref<any>(null);
const selectedRows = ref<any[]>([]);
const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

const { data: user, isError: isErrorUser, error: userError } = useUser(store);

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: ''
});

const requestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: true,
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: configurations, isLoading: isLoadingConfigurations, isError: isErrorConfigurations, error: configurationsError} = useConfigurations(store, requestParams, requestOptions);
const { mutateAsync: bulkRemove } = useBulkRemoveConfigurations(store);
const { mutateAsync: unbindConfiguration } = useUnbindConfiguration(store);

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

onMounted(async () => {
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

// Strict RBAC: only show Create when user has configuration write (hides for view_only)
const canCreateConfiguration = computed(() => {
  return user.value?.permissions?.configuration_write || user.value?.permissions?.configuration;
});

// Edit/Delete share the same permission as Create — anything that mutates
// a configuration requires configuration_write.
const canEdit = canCreateConfiguration;
const canDelete = canCreateConfiguration;

const displayRows = computed(() => {
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
      action: () => openDeleteModal(c),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditModal(c),
      enabled: canEdit.value && !c.configuration.origin,
      visible: canEdit.value && !c.configuration.origin,
    }],
    canDelete: canDelete.value,
  }));
  return rows;
});

async function openCreateModal() {
  configModal.value?.openCreate();
}

function openDeleteModal(configuration: ConfigurationResponse) {
  deleteModal.value?.openDelete(configuration);
}

function openEditModal(configuration: ConfigurationResponse) {
  configModal.value?.openEdit(configuration);
}

// Auto-generated configurations (bound to a service instance) can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.configuration?.type === 'custom';

const handleSelectionChange = (event: CustomEvent) => {
  selectedRows.value = event.detail.selectedRows;
};

const handleBulkDelete = async (items: ConfigurationResponse[], deleteImage: boolean) => {
  const configsToUnbind = items.filter((item) => item.configuration.boundApps ? item.configuration.boundApps.length > 0 : false);
  if (configsToUnbind.length > 0) {
    for (const config of configsToUnbind) {
      await Promise.all([
        ...config.configuration.boundApps!.map((a: string) => unbindConfiguration({ namespace: config.meta?.namespace || '', configName: config.meta?.name || '', appName: a })),
      ]);
    }
  }
  await bulkRemove({items,  deleteImage });
};

const handleBulkDeleteClick = () => {
  bulkDeleteModal.value?.openDelete(selectedRows.value);
};

const handleBulkDeleted = () => {
  selectedRows.value = [];
  tableEl.value?.clearSelection();
};

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

// NOTE: must be a named function declared here, not an inline arrow function
// in the template. Vue auto-unwraps top-level refs inside template
// expressions, so referencing `tableEl` directly in an inline template
// callback gives the already-unwrapped (initially null) value instead of
// the Ref object, and `tableEl.value = el` throws.
const setTableRef = (el: any) => {
  if (el) {
    tableEl.value = el;
    el.renderActions = makeActionMenu;
    el.rowSelectable = isRowSelectable;
  }
};

const openServiceModal = async (namespace: string, service: string) => {
  if (!namespace || !service) {
    return;
  }
  const serviceInstance = await fetchService(store, namespace, service);
  serviceInstanceModal.value?.openView(serviceInstance);
};

const allColumns = [
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
    field: 'meta.namespace',
    label: 'Namespace',
    width: '100px',
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    width: '200px',
    sortable: false,
    formatter: (_v: any, row: ConfigurationResponse) => makeNameLinks(
      row.configuration?.boundApps ?? [],
      { cluster: store.getters['clusterId'], namespace: row.meta?.namespace, resource: EPINIO_TYPES.APP },
      router
    )
  },
  {
    field: 'service',
    label: 'Service',
    width: '150px',
    sortable: false,
    formatter: (_v: any, row: ConfigurationResponse) => {
      const el = document.createElement('a');

      el.textContent = row.configuration.origin || '';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openServiceModal(row.meta?.namespace || '', row.configuration?.origin || '');
      });

      return el;
    }
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

// Drop lower-priority columns at smaller window widths
//   <1300px: hide Service and Created By
//   <1100px: also hide Age
const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1300) {
    hide.add('service');
    hide.add('configuration.user');
  }
  if (w < 1100) {
    hide.add('meta.createdAt');
  }

  return allColumns.filter(col => !hide.has(col.field));
});
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
          v-if="canCreateConfiguration"
          variant="primary"
          size="large"
          @click="openCreateModal"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
    <Banner
      v-if="isErrorUser"
      color="error"
      :label="userError?.message || t('epinio.user.errors.fetch')"
    />  
    <Banner
      v-if="isErrorConfigurations"
      color="error"
      :label="configurationsError?.message || t('epinio.configurations.errors.fetch')"
    /> 
    <div class="search-container">
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
      :total-items="configurations?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingConfigurations"
      key-field="id"
      @navigate="handleNavigate"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
      @selection-change="handleSelectionChange"
    />
    <ConfigurationModal ref="configModal" />
    <ConfigurationDeleteModal ref="deleteModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="configuration"
      :resource-type="resource"
      :show-unbind-notice="true"
      :bulk-remove="handleBulkDelete"
      @settled="handleBulkDeleted"
    />
    <ServiceInstanceModal ref="serviceInstanceModal" />
  </div>
</template>

<style lang="scss" scoped>
.search-container {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
  overflow-wrap: anywhere;
}

</style>
