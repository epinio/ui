<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import '@krumio/trailhand-ui/Components/data-table.js';
import '@krumio/trailhand-ui/Components/action-menu.js';

import { EPINIO_TYPES } from '../types';
import type { DataTableColumn } from '../components/tables/types';
import { useStore } from 'vuex';
import { startPolling, stopPolling } from '../utils/polling';
import { createDataTable, setupActionListener } from '../utils/table-helpers';

const pending = ref(true);
const store = useStore();
const tableContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  await Promise.all([
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP }),
    store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.SERVICE_INSTANCE }
    ),
  ]);
  pending.value = false;

  // Catalog services are static - only poll on initial load, not continuously
  // They're loaded above but don't need frequent updates
  startPolling(["namespaces", "applications"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications"]);
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
});

// Custom formatters
const formatBoundApps = (value: any, row: any) => {
  if (!row.applications || row.applications.length === 0) {
    return '-';
  }
  return row.applications.map((app: any) => app.meta.name).join(', ');
};

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
    field: 'metadata.namespace',
    label: 'Namespace'
  },
  {
    field: 'catalog_service',
    label: 'Service',
    sortable: false
  },
  {
    field: 'catalog_service_version',
    label: 'Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Apps',
    sortable: false,
    formatter: formatBoundApps
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

// Create and update table
const createOrUpdateTable = () => {
  if (!tableContainer.value) return;

  tableContainer.value.innerHTML = '';

  const tableElement = createDataTable(columns, rows.value);
  setupActionListener(tableElement);
  tableContainer.value.appendChild(tableElement);
};

// Watch for data changes
watch(rows, async () => {
  await nextTick();
  createOrUpdateTable();
}, { deep: true });

onMounted(async () => {
  await Promise.all([
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP }),
    store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.SERVICE_INSTANCE }
    ),
  ]);
  pending.value = false;

  await nextTick();
  createOrUpdateTable();

  // Catalog services are static - only poll on initial load, not continuously
  // They're loaded above but don't need frequent updates
  startPolling(["namespaces", "applications"], store);
});
</script>
<template>
  <div v-if="pending">Loading...</div>
  <div v-else ref="tableContainer"></div>
</template>

