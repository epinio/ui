<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { debounce } from 'lodash';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES, EPINIO_SERVICE_PARAM } from '../types';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';
import EpinioServiceModel from 'models/services';
import { overrideTableRows } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';

defineProps<{
  schema: object,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = useRouter();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;
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

const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);
const tableEl = ref<any>(null);
const selectedRows = ref<any[]>([]);
const displayRows = ref<any[]>([]);

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('service_write') || can('service'));
});
const canDelete = canEdit;
const canCreate = canEdit;

watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  const all = store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) as any[];
  // row.applications pulls from the separate Applications store slice; touch
  // it here too so Vue re-runs this watchEffect (and recomputes displayRows)
  // once that data arrives or changes, instead of leaving the Bound
  // Applications column stale until something unrelated re-triggers it.
  all.forEach((row: any) => { void row.status; void row.stateDisplay; void row.meta; void row.applications; });

  // Filter empty rows that are added during delete, and filter by active namespace
  const filtered = all.filter((row) => {
    if (!row.id) return false;
    const ns = row.meta?.namespace;

    return !activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[ns];
  });

  // Build the row action menu with RBAC gating. The model already gates the
  // base actions; here we inject the modal-driven Edit/Delete entries only
  // when the user has service write permissions.
  const rowActions = (row: EpinioServiceModel) => {
    const out: any[] = [];

    if (canEdit.value) {
      out.push({
        action: 'editServiceModal',
        label: 'Edit',
        enabled: true
      });
    }
    if (canDelete.value) {
      out.push({
        action: 'removeService',
        altAction: 'remove',
        bulkAction: 'removeService',
        bulkable: true,
        enabled: row.canDelete,
        icon: 'icon icon-trash',
        label: 'Delete',
        weight: -10
      });
    }


    return out;
  };

  const overrideProps = [
    {
      prop: 'availableActions',
      value: rowActions,
      conditionFn: () => true,
    },
    {
      prop: 'removeService',
      value: (row: EpinioServiceModel) => () => {
        deleteModal.value?.openDelete(row);
      },
      conditionFn: (row: EpinioServiceModel) => canDelete.value && row.canDelete,
    },
    {
      prop: 'editServiceModal',
      value: (row: EpinioServiceModel) => () => {
        serviceModal.value?.openEdit(row);
      },
      conditionFn: () => canEdit.value,
    }
  ];

  const processedRows = overrideTableRows(filtered, overrideProps);

  displayRows.value = [...processedRows];
});

onMounted(async () => {
  paginating.value = true;
  try {
    await Promise.all([
      store.dispatch('epinio/me'),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE }),
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
    ]);
  } finally {
    paginating.value = false;
  }
  startPolling(['services', 'applications', 'namespaces'], store);

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    serviceModal.value?.openCreate(query[EPINIO_SERVICE_PARAM] as string | undefined);
  }
});

onUnmounted(() => {
  stopPolling(['services', 'applications', 'namespaces']);
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

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    formatter: (_v: any, row: any) => {
      const el = document.createElement('a');

      el.textContent = row.nameDisplay || row.meta?.name || '';
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
    field: 'namespace',
    label: 'Namespace'
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
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
          @click="serviceModal.openCreate()"
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
    <ServiceInstanceModal ref="serviceModal" />
    <ServiceDeleteModal ref="deleteModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="service instance"
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
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

</style>
