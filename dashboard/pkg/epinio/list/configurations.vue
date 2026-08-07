<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeEmptyCell, makeNameLinks, makeActionMenu, overrideTableRows } from '../utils/table-formatters';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';
import { debounce } from 'lodash';
import { useConfigurations } from '../queries/useConfigurationQueries';
import { ListResourceRequestParams } from '../models/resource/ui-types';
import { ResourceTableRow } from '../models/resource/ui-types';
import { ConfigurationResponse } from '../models/configuration/ui-types';

const store = useStore();
const router = useRouter();

defineProps<{ schema: object }>(); // Keep for compatibility

const resource: string = EPINIO_TYPES.CONFIGURATION;

const configModal = ref<InstanceType<typeof ConfigurationModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ConfigurationDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const tableEl = ref<any>(null);
const selectedRows = ref<any[]>([]);
const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };
const displayRows = ref<any[]>([]);

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: ''
});

const searchQuery = ref<string>('');

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

const onSearch = debounce(async (query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const {data: configurations, isLoading: isLoadingConfigurations, isError: isErrorConfigurations, error: configurationsError} = useConfigurations(store, requestParams);

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await Promise.all([
    store.dispatch('epinio/me'),
    // Bound Applications/Service columns cross-reference these; fetch them
    // directly so they're populated on first load instead of depending on
    // another page (Applications/Services) having fetched them already.
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE }),
  ]);
  // startPolling(['configurations', 'applications', 'services'], store);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  // stopPolling(['configurations', 'applications', 'services']);
});

const handleCreateClick = () => {
  configModal.value?.openCreate();
};

// Strict RBAC: only show Create when user has configuration write (hides for view_only)
const canCreateConfiguration = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('configuration_write') || can('configuration');
});

// Edit/Delete share the same permission as Create — anything that mutates
// a configuration requires configuration_write.
const canEdit = canCreateConfiguration;
const canDelete = canCreateConfiguration;

watchEffect(() => {
  if (!configurations.value) {
    displayRows.value = [];
    return;
  }
  
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  // filter configurations by active namespace
  // TODO: move to backend query once epinio supports filtering by namespace
  const filteredConfigurations = (configurations.value.items ?? []).filter((s) => {
    const ns = s.meta?.namespace;
    return !activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[ns];
  });
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow[] = (filteredConfigurations ?? []).map((s) => ({
    ...s,
    id: s.meta.name, // stable, unique per namespace
    availableActions: [{
      label: 'Delete',
      action: () => openDeleteModal(s),
      enabled: canDelete.value,
      visible: canDelete.value,
      danger: true,
    }, {
      label: 'Edit',
      action: () => openEditModal(s),
      enabled: canEdit.value,
      visible: canEdit.value,
    }],
    canDelete: canDelete.value,
  }));
  displayRows.value = rows;
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
    formatter: (_v: any, row: ConfigurationResponse) => makeNameLinks(
      row.configuration?.origin ? [row.configuration.origin] : [],
      { cluster: store.getters['clusterId'], namespace: row.meta?.namespace, resource: EPINIO_TYPES.SERVICE_INSTANCE },
      router
    )
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
          @click="handleCreateClick"
        >
          {{ t('generic.create') }}
        </trailhand-button>
        <div v-else></div>
      </template>
    </Masthead>
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
      @settled="handleBulkDeleted"
    />
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
