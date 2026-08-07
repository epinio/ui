<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { debounce } from 'lodash';
import { useRouter } from 'vue-router';
import { EPINIO_TYPES, EPINIO_SERVICE_PARAM } from '../types';
import Masthead from '@shell/components/ResourceList/Masthead';
import { makeStateTag, makeRouterLink, makeNameLinks, makeActionMenu } from '../utils/table-formatters';
import ServiceDeleteModal from '../components/service/ServiceDeleteModal.vue';
import ServiceInstanceModal from '../components/service/ServiceInstanceModal.vue';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';
import { ListResourceRequestParams, ResourceTableRow } from '../models/resource/ui-types';
import { useServices } from '../queries/useServiceQueries';
import { useBulkRemoveServiceInstances, useUnbindServiceInstance } from '../queries/useServiceMutations';
import { ServiceInstance } from '../models/service/ui-types';

defineProps<{
  schema: object,
}>();

const store = useStore() as any;
const t = store.getters['i18n/t'];
const router = useRouter();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;
const serviceModal = ref<InstanceType<typeof ServiceInstanceModal> | null>(null);
const deleteModal = ref<InstanceType<typeof ServiceDeleteModal> | null>(null);
const bulkDeleteModal = ref<InstanceType<typeof BulkDeleteModal> | null>(null);

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

const {data: services, isLoading: isLoadingServices, isError: isErrorServices, error: servicesError} = useServices(store, requestParams);
const { mutateAsync: bulkRemove } = useBulkRemoveServiceInstances(store);
const { mutateAsync: unbindServiceInstance } = useUnbindServiceInstance(store);

const tableEl = ref<any>(null);
const selectedRows = ref<ResourceTableRow[]>([]);
const displayRows = ref<ResourceTableRow[]>([]);

const canEdit = computed(() => {
  const can = store.getters['epinio/can'];

  return can && (can('service_write') || can('service'));
});
const canDelete = canEdit;
const canCreate = canEdit;

watchEffect(() => {
  if (!services.value) {
    displayRows.value = [];
    return;
  }
  
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  // filter services by active namespace
  // TODO: move to backend query once epinio supports filtering by namespace
  const filteredServices = (services.value.items ?? []).filter((s) => {
    const ns = s.meta?.namespace;
    return !activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[ns];
  });
  // Add custom namespace delete action to replace the built in rancher shell flow.
  // Gate by namespace write perms so view-only / app-only roles don't see Delete.
  const rows: ResourceTableRow[] = (filteredServices ?? []).map((s) => ({
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

onMounted(async () => {
  store.dispatch('epinio/me');

  // TODO: remove and fetch apps with tanstack
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE });

  const query = store.$router.currentRoute._value.query;

  if (query.mode === 'openModal') {
    serviceModal.value?.openCreate(query[EPINIO_SERVICE_PARAM] as string | undefined);
  }
});

async function openCreateModal() {
  serviceModal.value?.openCreate();
}

function openDeleteModal(service: ServiceInstance) {
  deleteModal.value?.openDelete(service);
}

function openEditModal(service: ServiceInstance) {
  serviceModal.value?.openEdit(service);
}

// Services without service_write/service permission on that row can't be
// individually deleted, so they're excluded from bulk selection too.
const isRowSelectable = (row: any) => row.canDelete;

const handleSelectionChange = (event: CustomEvent) => {
  selectedRows.value = event.detail.selectedRows;
};

const handleBulkDelete = async (items: ServiceInstance[], deleteImage: boolean) => {
  const servicesToUnbind = items.filter((item) => item.boundApps ? item.boundApps.length > 0 : false);
  if (servicesToUnbind.length > 0) {
    for (const service of servicesToUnbind) {
      await Promise.all([
      ...service.boundApps!.map((a: string) => unbindServiceInstance({ namespace: service.meta?.namespace || '', serviceName: service.meta?.name || '', request: { appName: a } })),
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
    field: 'meta.namespace',
    label: 'Namespace'
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
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: ServiceInstance) => makeNameLinks(
      row.boundApps,
      { cluster: store.getters['clusterId'], namespace: row.meta?.namespace, resource: EPINIO_TYPES.APP },
      router
    )
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
          @click="openCreateModal"
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
    <Banner
      v-if="isErrorServices"
      color="error"
      :label="servicesError?.message || t('epinio.service.errors.fetch')"
    />  
    <trailhand-table
      :ref="setTableRef"
      :rows="displayRows"
      :columns="columns"
      :searchable="false"
      :selectable="canDelete"
      :server-side="true"
      :total-items="services?.totalItems ?? 0"
      :current-page="requestParams.page"
      :loading="isLoadingServices"
      key-field="id"
      @navigate="handleNavigate"
      @page-change="(e: CustomEvent) => { requestParams.page = e.detail.page; }"
      @selection-change="handleSelectionChange"
    />
    <ServiceInstanceModal ref="serviceModal" />
    <ServiceDeleteModal ref="deleteModal" />
    <BulkDeleteModal
      ref="bulkDeleteModal"
      resource-label="service instance"
      :resource-type="resource"
      :show-unbind-notice="true"
      :bulk-remove="handleBulkDelete"
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
