<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { debounce } from 'lodash';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES } from '../../../../types';
import { startPolling, stopPolling } from '../../../../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import {
  makeActionMenu,
  makeStateTag,
  makeAppRoutesCell,
  makeNameLinks,
} from '../../../../utils/table-formatters';
import { overrideTableRows } from '../../../../utils/table-formatters';
import AppModal from '../../../../components/application/AppModal.vue';
import AppDeleteModal from '../../../../components/application/AppDeleteModal.vue';
import BulkDeleteModal from '../../../../components/BulkDeleteModal.vue';
import ExportAppModal from '../../../../dialog/ExportAppModal.vue';
import EpinioApplicationModel from 'models/applications';

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = useRouter();

const resource: string = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));
const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

const searchQuery = ref<string>('');

const paginating = ref(false);

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

const appModal = ref<InstanceType<typeof AppModal> | null>(null);
const deleteModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const exportAppModal = ref<InstanceType<typeof ExportAppModal> | null>(null);
const deleteAppModal = ref<InstanceType<typeof AppDeleteModal> | null>(null);

const tableEl = ref<any>(null);
const selectedRows = ref<any[]>([]);
const displayRows = ref<any[]>([]);

const canCreate = computed(() => {
  const canGetter = store.getters['epinio/can'];
  return canGetter && (
    canGetter('app_create') || canGetter('app_write') || canGetter('app')
  );
});
const canEdit = computed(() => {
  const canGetter = store.getters['epinio/can'];
  return canGetter && (
    canGetter('app_update') || canGetter('app_write') || canGetter('app')
  );
});
const canDelete = computed(() => {
  const canGetter = store.getters['epinio/can'];
  return canGetter && (
    canGetter('app_delete') || canGetter('app_write') || canGetter('app')
  );
});

const handleCreateClick = () => {
  appModal.value?.openCreate();
};

// Watch the active namespace cache key and update the active namespaces in the store
watch(
  () => {
    void store.state.activeNamespaceCacheKey;
    const active = store.state.activeNamespaceCache;
    return active ? Object.keys(active) : null;
  },
  async (namespacesArray) => {
    paginating.value = true;
    try {
      await store.dispatch('epinio/setActiveNamespaces', { type: resource, namespaces: namespacesArray });
    } finally {
      paginating.value = false;
    }
  
  },
  { immediate: true }
);

watchEffect(async () => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.APP) as any[];
  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; void row.boundapps; });

  // Filter empty rows that are added during delete
  const filtered = all.filter((row) => {
    if (!row.id) return false;
    return true;
  });

  const overrideProps = [
    {
      prop: 'availableActions',
      value: (row: EpinioApplicationModel) => {
        const actions = [...row.availableActions];
        const goToEditIndex = actions.findIndex((a: any) => a.action === 'goToEdit');
        const exportAppIndex = actions.findIndex((a: any) => a.action === 'exportApp');
        const deleteAppIndex = actions.findIndex((a: any) => a.action === 'promptRemove');
        const newEditAction = {
          action: 'goToEdit',
          label: 'Edit',
          enabled: true
        };
        const newExportAction = {
          action: 'exportApp',
          label: 'Export',
          enabled: true
        };
        const newDeleteAction = {
          action: 'deleteApp',
          label: 'Delete',
          enabled: true
        };
        if (goToEditIndex !== -1 && canEdit.value) {
          actions.splice(goToEditIndex, 1, newEditAction);
        } else if (canEdit.value) {
          actions.push(newEditAction);
        } else if (goToEditIndex !== -1 && !canEdit.value) {
          actions.splice(goToEditIndex, 1);
        }

        if (exportAppIndex !== -1) {
          actions.splice(exportAppIndex, 1, newExportAction);
        }

        if (deleteAppIndex !== -1 && canEdit.value) {
          actions.splice(deleteAppIndex, 1, newDeleteAction);
        } else if (deleteAppIndex !== -1 && !canEdit.value) {
          actions.splice(deleteAppIndex, 1);
        }
        return actions;
      },
      conditionFn: () => {
        return true;
      },
    },
    {
      prop: 'goToEdit',
      value: (row: EpinioApplicationModel) => () => {
        appModal.value?.openEdit(row);
      },
      conditionFn: () => {
        return true;
      },
    },
    {
      prop: 'exportApp',
      value: (row: EpinioApplicationModel) => () => {
        exportAppModal.value?.openExport([row]);
      },
      conditionFn: () => {
        return true;
      },
    },
    {
      prop: 'deleteApp',
      value: (row: EpinioApplicationModel) => () => {
        deleteModal.value?.openDelete(row);
      },
      conditionFn: () => {
        return true;
      },
    }
  ];

  const processedRows = overrideTableRows(filtered, overrideProps);

  displayRows.value = [...processedRows];
});

onMounted(async () => {
  window.addEventListener('resize', onResize);
  paginating.value = true;
  try {
    await Promise.all([
      store.dispatch('epinio/me'),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
    ]);
  } finally {
    paginating.value = false;
  }
  startPolling(['applications', 'configurations', 'services'], store);

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    appModal.value?.openCreate();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling(['applications', 'configurations', 'services']);
});

// Services without service_write/service permission on that row can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.canDelete;

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

// NOTE: must be a named function declared here, not an inline arrow function
// in the template, see feedback_vue_ref_unwrap_bug.md. Vue auto-unwraps
// top-level refs inside template expressions, so referencing `tableEl`
// directly in an inline template callback gives the already-unwrapped
// (initially null) value instead of the Ref object, and `tableEl.value = el`
// throws, silently aborting the rest of the block.
const setTableRef = (el: any) => {
  if (el) {
    tableEl.value = el;
    el.renderActions = makeActionMenu;
    el.rowSelectable = isRowSelectable;
  }
};

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

const allColumns = [
  {
    field:     'stateDisplay',
    label:     'State',
    width:     '110px',
    formatter: (_value: string, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '125px',
    formatter: (_value: any, row: any) => makeNameLinks(
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
  { field: 'deployment.status', label: 'Status', width: '75px' },
  {
    field:     'route',
    label:     'Routes',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeAppRoutesCell(row)
  },
  {
    field:     'boundConfigs',
    label:     'Bound Configs',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeNameLinks(
      row.configuration?.configurations,
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.CONFIGURATION },
      router
    )
  },
  {
    field:     'boundServices',
    label:     'Bound Services',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeNameLinks(
      row.configuration?.services,
      { cluster: store.getters['clusterId'], namespace: row.meta.namespace, resource: EPINIO_TYPES.SERVICE_INSTANCE },
      router
    )
  },
  { field: 'deployment.username', label: 'Last Deployed By', width: '150px' },
  { field: 'meta.createdAt',      label: 'Age',              width: '50px', formatter: 'age' }
];

const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1900) hide.add('deployment.username');
  if (w < 1700) hide.add('deployment.status');
  if (w < 1600) { hide.add('boundConfigs'); hide.add('boundServices'); }
  if (w < 1150) hide.add('meta.createdAt');
  if (w < 875)  hide.add('route');

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
    <AppModal ref="appModal" />
    <AppDeleteModal ref="deleteModal" />
    <ExportAppModal ref="exportAppModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="application"
      :resource-type="resource"
      :show-delete-image-option="true"
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
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

</style>
