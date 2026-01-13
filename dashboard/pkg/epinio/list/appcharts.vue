<script setup lang="ts">
import '@krumio/trailhand-ui/data-table';
import '@krumio/trailhand-ui/action-menu';
import type { DataTableColumn } from '../components/tables/types';
import { EPINIO_TYPES } from '../types';

import { useStore } from 'vuex';
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import { createDataTable, setupActionListener, applyNamespaceFilter } from '../utils/table-helpers';

const store = useStore();

defineProps<{ schema: object }>(); // Keep for compatibility

const pending = ref<boolean>(true);
const tableContainer = ref<HTMLElement | null>(null);

const rows = computed(() => {
  const allRows = store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS);
  return applyNamespaceFilter(store, allRows);
});

const columns: DataTableColumn[] = [
  {
    field: 'meta.name',
    label: 'Name'
  },
  {
    field: 'description',
    label: 'Description'
  },
  {
    field: 'helm_chart',
    label: 'Helm Chart'
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
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP_CHARTS });

  pending.value = false;

  await nextTick();
  createOrUpdateTable();

  startPolling(["appcharts"], store);
});

onUnmounted(() => {
  stopPolling(["appcharts"]);
});
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else ref="tableContainer"></div>
</template>
