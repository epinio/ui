<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeEmptyCell, makeRouterLinks, makeRouterLinksOrEmpty, makeActionMenu, overrideTableRows } from '../utils/table-formatters';
import ConfigurationModal from '../components/configuration/ConfigurationModal.vue';
import ConfigurationDeleteModal from '../components/configuration/ConfigurationDeleteModal.vue';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';
import { debounce } from 'lodash';

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

const paginating = ref(false);

const searchQuery = ref<string>('');

async function goToPage(page: number) {
  const meta = paginationMeta.value;

  if (meta && (page < 1 || page > meta.totalPages)) return;
  paginating.value = true;
  try {
    await store.dispatch('epinio/goToPage', { type: resource, page });
  } finally {
    paginating.value = false;
  }
}

const onSearch = debounce(async (query: string) => {
  paginating.value = true;
  try {
    await store.dispatch('epinio/search', { type: resource, query });
  } finally {
    paginating.value = false;
  }
}, 500);

watch(searchQuery, (newQuery) => {
  onSearch(newQuery);
});

onMounted(async () => {
  window.addEventListener('resize', onResize);
  paginating.value = true;
  try {
    await Promise.all([
      store.dispatch('epinio/me'),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION }),
      // Bound Applications/Service columns cross-reference these; fetch them
      // directly so they're populated on first load instead of depending on
      // another page (Applications/Services) having fetched them already.
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE }),
    ]);
  } finally {
    paginating.value = false;
  }
  startPolling(['configurations', 'applications', 'services'], store);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling(['configurations', 'applications', 'services']);
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
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  const all = store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION) as any[];

  // row.applications/row.service pull from the separate Applications/Services
  // store slices; touch them here too so Vue re-runs this watchEffect (and
  // recomputes displayRows) once that data arrives, instead of leaving the
  // Bound Applications/Service columns stale until something unrelated
  // happens to re-trigger it.
  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; void row.applications; void row.service; });

  const filtered = all.filter((row: any) => {
    const ns = row.meta?.namespace;

    return !activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[ns];
  });

  const overrides = [
    {
      prop: 'availableActions',
      value: (row: any) => {
        const out: any[] = [];

        if (canEdit.value) {
          out.push({
            action:  'editConfigModal',
            label:   'Edit',
            enabled: row.configuration?.type === 'custom',
            icon:    'icon icon-edit',
          });
        }
        if (canDelete.value) {
          out.push({
            action:  'deleteConfigModal',
            label:   'Delete',
            enabled: row.configuration?.type === 'custom',
            icon:    'icon icon-trash',
            weight:  -10,
          });
        }

        return out;
      },
      conditionFn: () => true,
    },
    {
      prop:        'editConfigModal',
      value:       (row: any) => () => { configModal.value?.openEdit(row); },
      conditionFn: (row: any) => canEdit.value && row.configuration?.type === 'custom',
    },
    {
      prop:        'deleteConfigModal',
      value:       (row: any) => () => { deleteModal.value?.openDelete(row); },
      conditionFn: (row: any) => canDelete.value && row.configuration?.type === 'custom',
    },
  ];

  displayRows.value = [...overrideTableRows(filtered, overrides)];
});

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
    width: '300px',
    formatter: (_v: any, row: any) => {
      const el = document.createElement('a');

      el.textContent = row.nameDisplay || row.meta?.name || '';
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
    field: 'namespace',
    label: 'Namespace',
    width: '100px',
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    width: '250px',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'service',
    label: 'Service',
    width: '150px',
    sortable: false,
    formatter: (_v: any, row: any) => row.service
      ? makeRouterLinks([row.service], router)
      : makeEmptyCell()
  },
  {
    field: 'variableCount',
    label: 'No. of Variables',
    width: '150px'
  },
  {
    field: 'configuration.user',
    label: 'Created By',
    width: '150px',
    formatter: (_v: any, row: any) => row.configuration?.user || makeEmptyCell()
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
      :server-side="!!paginationMeta"
      :total-items="paginationMeta?.totalItems ?? displayRows.length"
      :current-page="currentPage"
      :loading="paginating"
      key-field="id"
      @navigate="handleNavigate"
      @page-change="(e: CustomEvent) => goToPage(e.detail.page)"
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
