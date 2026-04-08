<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, watchEffect } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const pending = ref(true);
const paginating = ref(false);
const rows = ref<any[]>([]);

const handlePageChange = async(e: CustomEvent) => {
  if (paginating.value) return;
  paginating.value = true;
  try {
    await store.dispatch('epinio/goToPage', { type: EPINIO_TYPES.APP_CHARTS, page: e.detail.page });
  } finally {
    paginating.value = false;
  }
};

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
    :loading="pending || paginating"
    :total-items="store.getters['epinio/paginationMeta'](EPINIO_TYPES.APP_CHARTS)?.totalItems ?? store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS).length"
    :server-side="!!store.getters['epinio/paginationMeta'](EPINIO_TYPES.APP_CHARTS)"
    rows-per-page="10"
    key-field="id"
    @page-change="handlePageChange"
  />
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
