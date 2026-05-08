<script setup lang="ts">
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import { EPINIO_TYPES } from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import Masthead from '@shell/components/ResourceList/Masthead';
import BulkDeleteModal from '../components/BulkDeleteModal.vue';

import { useStore } from 'vuex';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

const store = useStore();
const t = store.getters['i18n/t'];

defineProps<{ schema: object }>(); // Keep for compatibility

const resource = EPINIO_TYPES.CONFIGURATION;

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-resource-create', {
    cluster: store.getters['clusterId'],
    resource: EPINIO_TYPES.CONFIGURATION,
  })
);

// Strict RBAC: only show Create when user has configuration write (hides for view_only)
const canCreateConfiguration = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('configuration_write') || can('configuration');
});

const canDeleteConfiguration = computed(() => {
  const can = store.getters['epinio/can'];
  const perms = store.getters['epinio/permissions']?.();

  if (!can || !perms || Object.keys(perms).length === 0) {
    return false;
  }

  return can('configuration_write') || can('configuration');
});

const pending = ref<boolean>(true);

onMounted(async () => {
  await store.dispatch('epinio/me');
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });

  pending.value = false;
  startPolling([
    "applications",
    "namespaces",
    "appcharts",
    "configurations",
    "services"
  ], store);
});

onUnmounted(() => {
  stopPolling([
    "applications",
    "namespaces",
    "appcharts",
    "configurations",
    "services"
  ]);
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION);
});
const selectedConfigurationIds = ref<string[]>([]);
const showDeleteModal = ref(false);
const deletingSelected = ref(false);
const selectedCount = computed(() => selectedConfigurationIds.value.length);

function configKey(config: any): string {
  return String(config?.id || `${ config?.meta?.namespace || 'default' }/${ config?.meta?.name || '' }`);
}

const selectedConfigurations = computed(() => {
  const selectedSet = new Set(selectedConfigurationIds.value);
  return rows.value.filter((config: any) => selectedSet.has(configKey(config)));
});

const selectedConfigurationLabels = computed(() => {
  return selectedConfigurations.value.map((config: any) => `${ config.meta?.namespace }/${ config.meta?.name }`);
});

function selectedKeysForRows(items: any[]) {
  const selectedSet = new Set(selectedConfigurationIds.value);
  return items.map((item) => configKey(item)).filter((id) => selectedSet.has(id));
}

function onSelectionChange(selectedRows: any[]) {
  selectedConfigurationIds.value = selectedRows.map((row: any) => configKey(row));
}

function openDeleteModal() {
  if (!canDeleteConfiguration.value || selectedCount.value === 0 || deletingSelected.value) {
    return;
  }
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
}

async function deleteSelectedConfigurations() {
  if (!selectedConfigurations.value.length || deletingSelected.value) {
    return;
  }

  deletingSelected.value = true;
  try {
    await selectedConfigurations.value[0].bulkRemove(selectedConfigurations.value, {});
    selectedConfigurationIds.value = [];
    closeDeleteModal();
    await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION, opt: { force: true } });
  } catch (e: any) {
    await store.dispatch('growl/fromError', { title: t('generic.notification.error'), err: e }, { root: true });
  } finally {
    deletingSelected.value = false;
  }
}

const columns: DataTableColumn[] = [
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false
  },
  {
    field: 'service',
    label: 'Service',
    sortable: false
  },
  {
    field: 'variableCount',
    label: 'No. of Variables'
  },
  {
    field: 'configuration.user',
    label: 'Created By'
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
        v-if="canDeleteConfiguration"
        class="btn mr-10 bulk-delete-btn"
        :disabled="selectedCount === 0 || deletingSelected"
        @click="openDeleteModal"
      >
        {{ deletingSelected ? t('epinio.bulkDelete.deletingButton') : t('epinio.bulkDelete.button', { count: selectedCount }) }}
      </button>
      <button
        v-if="canCreateConfiguration"
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
    :selectable="canDeleteConfiguration"
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
    <template #cell:service="{ row }">
      <LinkDetail
        v-if="row.service"
        :key="row.service.id"
        :row="row.service"
        :value="row.service.meta.name"
      />
      <span
        v-else
        class="text-muted"
      >&nbsp;</span>
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
    :show="showDeleteModal && canDeleteConfiguration"
    :title="t('epinio.bulkDelete.titles.configurations', { count: selectedConfigurations.length })"
    :item-labels="selectedConfigurationLabels"
    :deleting="deletingSelected"
    :description="t('epinio.bulkDelete.descriptions.configurations')"
    @close="closeDeleteModal"
    @confirm="deleteSelectedConfigurations"
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
