<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { computed, ref, onMounted, onUnmounted, watchEffect } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

const pending = ref(true);
const rows = ref<any[]>([]);

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](EPINIO_TYPES.APP_CHARTS));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](EPINIO_TYPES.APP_CHARTS));

const paginating = ref(false);

async function goToPage(page: number) {
  const meta = paginationMeta.value;

  if (meta && (page < 1 || page > meta.totalPages)) return;
  paginating.value = true;
  try {
    await store.dispatch('epinio/goToPage', { type: EPINIO_TYPES.APP_CHARTS, page });
  } finally {
    paginating.value = false;
  }
}

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
    :server-side="!!paginationMeta"
    :total-items="paginationMeta?.totalItems ?? rows.length"
    :current-page="currentPage"
    :loading="pending || paginating"
    key-field="id"
    @page-change="(e: CustomEvent) => goToPage(e.detail.page)"
  />
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}

</style>
