<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

import { EPINIO_TYPES } from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import { useStore } from 'vuex';
import { startPolling, stopPolling } from '../utils/polling';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';

const pending = ref(true);
const store = useStore();
const t = store.getters['i18n/t'];

const schema = ref(store.getters['epinio/schemaFor'](EPINIO_TYPES.SERVICE_INSTANCE));
const resource = EPINIO_TYPES.SERVICE_INSTANCE;

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-resource-create', {
    cluster: store.getters['clusterId'],
    resource: EPINIO_TYPES.SERVICE_INSTANCE,
  })
);

// Strict RBAC: only show Create when we know the user has service write perms (hides for view_only)
const canCreateService = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  // If we don't have a permission helper or a populated perms map yet, hide Create
  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('service_write') || can('service');
});

const canDeleteService = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('service_write') || can('service');
});

onMounted(async () => {
  await store.dispatch('epinio/me');
  await Promise.all([
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP }),
    store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.SERVICE_INSTANCE }
    ),
  ]);
  pending.value = false;

  startPolling(["namespaces", "applications", "services"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications", "services"]);
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
});
const selectedServiceIds = ref<string[]>([]);
const showDeleteModal = ref(false);
const deletingSelected = ref(false);
const selectedCount = computed(() => selectedServiceIds.value.length);

function serviceKey(service: any): string {
  return String(service?.id || `${ service?.meta?.namespace || 'default' }/${ service?.meta?.name || '' }`);
}

const selectedServices = computed(() => {
  const selectedSet = new Set(selectedServiceIds.value);
  return rows.value.filter((service: any) => selectedSet.has(serviceKey(service)));
});

const selectedServiceLabels = computed(() => selectedServices.value.map((service: any) => `${ service.meta?.namespace }/${ service.meta?.name }`));

function selectedKeysForRows(items: any[]) {
  const selectedSet = new Set(selectedServiceIds.value);
  return items.map((item) => serviceKey(item)).filter((id) => selectedSet.has(id));
}

function onSelectionChange(selectedRows: any[]) {
  selectedServiceIds.value = selectedRows.map((row: any) => serviceKey(row));
}

function openDeleteModal() {
  if (!canDeleteService.value || selectedCount.value === 0 || deletingSelected.value) {
    return;
  }
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
}

async function deleteSelectedServices() {
  if (!selectedServices.value.length || deletingSelected.value) {
    return;
  }

  deletingSelected.value = true;
  try {
    await selectedServices.value[0].bulkRemove(selectedServices.value, {});
    selectedServiceIds.value = [];
    closeDeleteModal();
    await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE, opt: { force: true } });
  } catch (e: any) {
    await store.dispatch('growl/fromError', { title: t('generic.notification.error'), err: e }, { root: true });
  } finally {
    deletingSelected.value = false;
  }
}

const columns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];
</script>
<template>
  <Masthead
    :schema="schema"
    :resource="resource"
  >
    <template #createButton>
      <button
        v-if="canDeleteService"
        class="btn mr-10 bulk-delete-btn"
        :disabled="selectedCount === 0 || deletingSelected"
        @click="openDeleteModal"
      >
        {{ deletingSelected ? t('epinio.bulkDelete.deletingButton') : t('epinio.bulkDelete.button', { count: selectedCount }) }}
      </button>
      <button
        v-if="canCreateService"
        class="btn role-primary"
        @click="store.$router.push(createLocation)"
      >
        {{ t('generic.create') }}
      </button>
    </template>
  </Masthead>
  <DataTable
    :rows="rows"
    :columns="columns"
    :loading="pending"
    :selectable="canDeleteService"
    :selected-row-keys="selectedKeysForRows(rows)"
    @selection-change="onSelectionChange"
  >
    <template #cell:stateDisplay="{ row }">
      <BadgeStateFormatter
        :row="row"
        :value="row.stateDisplay"
      />
    </template>
    <template #cell:nameDisplay="{ row }">
      <LinkDetail
        :row="row"
        :value="row.nameDisplay"
      />
    </template>
    <template #cell:catalog_service="{ row }">
      <LinkDetail
        v-if="row.serviceLocation"
        :row="{ detailLocation: row.serviceLocation }"
        :value="row.catalog_service"
      />
      <span v-else>{{ row.catalog_service }}</span>
    </template>
    <template #cell:boundApps="{ row }">
      <span v-if="row.applications && row.applications.length">
        <template v-for="(app, index) in row.applications" :key="app.id">
          <LinkDetail
            :row="app"
            :value="app.meta.name"
          />
          <span
            v-if="index < row.applications.length - 1"
            :key="app.id + 'i'"
          >, </span>
        </template>
      </span>
      <span
        v-else
        class="text-muted"
      >&nbsp;</span>
    </template>
  </DataTable>
  <BulkDeleteModal
    :show="showDeleteModal && canDeleteService"
    :title="t('epinio.bulkDelete.titles.services', { count: selectedServices.length })"
    :item-labels="selectedServiceLabels"
    :deleting="deletingSelected"
    :description="t('epinio.bulkDelete.descriptions.services')"
    @close="closeDeleteModal"
    @confirm="deleteSelectedServices"
  />
</template>

<style scoped lang="scss">
.bulk-delete-btn:disabled {
  background-color: var(--disabled-bg) !important;
  border-color: var(--border) !important;
  color: var(--disabled-text) !important;
  opacity: 1;
}

.bulk-delete-btn:not(:disabled) {
  background-color: var(--error) !important;
  border-color: var(--error) !important;
  color: var(--error-contrast, #fff) !important;
}

.bulk-delete-btn:not(:disabled):hover {
  filter: brightness(0.92);
}
</style>

