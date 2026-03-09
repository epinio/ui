<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import { EPINIO_TYPES } from '../types';
import { startPolling, stopPolling } from '../utils/polling';
import Masthead from '@shell/components/ResourceList/Masthead';
import { createEpinioRoute } from '../utils/custom-routing';
import { makeStateTag, makeRouterLink, makeRouterLinksOrEmpty, makeActionMenu } from '../utils/table-formatters';

defineProps<{
  schema: object,
}>();

const resource: string = EPINIO_TYPES.SERVICE_INSTANCE;

const pending = ref(true);
const store = useStore();
const router = useRouter();

onMounted(async () => {
  await Promise.all([
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP }),
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.SERVICE_INSTANCE }),
  ]);
  pending.value = false;

  startPolling(['namespaces', 'applications', 'services'], store);
});

onUnmounted(() => {
  stopPolling(['namespaces', 'applications', 'services']);
});

const handleCreateClick = () => {
  store.$router.push(createEpinioRoute('c-cluster-resource-create', { resource: EPINIO_TYPES.SERVICE_INSTANCE }));
};

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE);
});

const handleNavigate = (event: CustomEvent) => {
  router.push(event.detail.url);
};

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px',
    formatter: (_v: any, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    link:  (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  {
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLink(row.catalog_service, row.serviceLocation, router)
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false,
    formatter: (_v: any, row: any) => makeRouterLinksOrEmpty(row.applications, router)
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
  <trailhand-table
    :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
    :rows="[...rows]"
    :columns="columns"
    :searchable="true"
    key-field="id"
    @navigate="handleNavigate"
  />
</template>

<style lang="scss" scoped>
trailhand-table {
  --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
  --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
}
</style>
