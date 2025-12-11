<script setup lang="ts">
import '@krumio/trailhand-ui/Components/data-table.js';
import '@krumio/trailhand-ui/Components/action-menu.js';
import type { DataTableColumn } from '../components/tables/types';
import { EPINIO_TYPES } from '../types';

import { useStore } from 'vuex';
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import { createDataTable, setupActionListener } from '../utils/table-helpers';

const store = useStore();

defineProps<{ schema: object }>(); // Keep for compatibility

const pending = ref<boolean>(true);
const tableContainer = ref<HTMLElement | null>(null);

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION);
});

// Custom formatters
const formatBoundApps = (value: any, row: any) => {
  if (!row.applications || row.applications.length === 0) {
    return '-';
  }
  return row.applications.map((app: any) => app.meta.name).join(', ');
};

const formatService = (value: any, row: any) => {
  return row.service ? row.service.meta.name : '-';
};

const columns: DataTableColumn[] = [
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'meta.namespace',
    label: 'Namespace'
  },
  {
    field: 'boundApps',
    label: 'Bound Apps',
    sortable: false,
    formatter: formatBoundApps
  },
  {
    field: 'service',
    label: 'Service',
    sortable: false,
    formatter: formatService
  },
  {
    field: 'variableCount',
    label: 'Variable Count'
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
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });

  pending.value = false;

  await nextTick();
  createOrUpdateTable();

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
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else ref="tableContainer"></div>
</template>
