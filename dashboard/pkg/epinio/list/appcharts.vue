<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, watchEffect } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const pending = ref(true);
const rows = ref<any[]>([]);

watchEffect(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS) as any[];

  // Touch meta so _MERGE polling (which deletes/re-adds all properties) re-runs this effect
  all.forEach((row: any) => { void row.meta; });
  rows.value = [...all];
});

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP_CHARTS });
  pending.value = false;
  startPolling(['appcharts'], store);
});

onUnmounted(() => {
  stopPolling(['appcharts']);
});

const columns = [
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
    field:     'meta.createdAt',
    label:     'Age',
    formatter: 'age'
  }
];
</script>

<template>
  <trailhand-table
    :rows="rows"
    :columns="columns"
    :searchable="true"
    :loading="pending"
    key-field="id"
  />
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
