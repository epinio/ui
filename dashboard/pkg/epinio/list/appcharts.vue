<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

const pending = ref<boolean>(true);
defineProps<{ schema: object }>(); // Keep for compatibility

const store = useStore();

onMounted(async () => {
  await store.dispatch(
    `epinio/findAll`,
    { type: EPINIO_TYPES.APP_CHARTS }
  );
  pending.value = false;
  startPolling(["appcharts"], store);
});

onUnmounted(() => {
  stopPolling(["appcharts"]);
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS);
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
</script>

<template>
  <DataTable
    :rows="rows"
    :columns="columns"
    :loading="pending"
  >
    <template #cell:stateDisplay="{ row }">
      <BadgeStateFormatter
        :row="row"
        :value="row.stateDisplay"
      />
    </template>
  </DataTable>
</template>
