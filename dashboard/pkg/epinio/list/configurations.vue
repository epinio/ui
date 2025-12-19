<script setup lang="ts">
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import { EPINIO_TYPES } from '../types';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';

import { useStore } from 'vuex';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';

const store = useStore();

defineProps<{ schema: object }>(); // Keep for compatibility

const pending = ref<boolean>(true);

onMounted(async () => {
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
    field: 'meta.createdBy',
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
</template>
