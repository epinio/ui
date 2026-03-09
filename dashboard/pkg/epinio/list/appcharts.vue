<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

const pending = ref<boolean>(true);
defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP_CHARTS });
  pending.value = false;
  startPolling(['appcharts'], store);
});

onUnmounted(() => {
  stopPolling(['appcharts']);
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS);
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
  <data-table
    :rows="[...rows]"
    :columns="columns"
    :searchable="true"
    key-field="id"
  />
</template>

<style lang="scss" scoped>
data-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
