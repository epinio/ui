<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { createEpinioRoute } from '../utils/custom-routing';
import { makeEmptyCell, makeRouterLinks, makeRouterLinksOrEmpty } from '../utils/table-formatters';

const store = useStore();
const router = useRouter();

defineProps<{ schema: object }>(); // Keep for compatibility

const resource: string = EPINIO_TYPES.CONFIGURATION;

const pending = ref<boolean>(true);

onMounted(async () => {
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP });
  store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE });
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CONFIGURATION });

  pending.value = false;
  startPolling([
    'applications',
    'namespaces',
    'appcharts',
    'configurations',
    'services'
  ], store);
});

onUnmounted(() => {
  stopPolling([
    'applications',
    'namespaces',
    'appcharts',
    'configurations',
    'services'
  ]);
});

const handleCreateClick = () => {
  store.$router.push(createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.CONFIGURATION }));
};

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION);
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const columns = [
  {
    field: 'nameDisplay',
    label: 'Name',
    link: (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
  },
  {
    field: 'service',
    label: 'Service',
    sortable: false,
    formatter: (_v: any, row: any) => row.service
      ? makeRouterLinks([row.service], router)
      : makeEmptyCell()
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
      <trailhand-button
        variant="primary"
        size="large"
        @click="handleCreateClick"
      >
        {{ t('generic.create') }}
      </trailhand-button>
    </template>
  </Masthead>
  <data-table
    :rows="rows"
    :columns="columns"
    :searchable="true"
    key-field="id"
    @navigate="handleNavigate"
  />
</template>

<style lang="scss" scoped>
data-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
}
</style>
