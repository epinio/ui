<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';
import { startPolling, stopPolling } from '../../../../utils/polling';
import {
  makeActionMenu,
  makeStateTag,
  makeAppRoutesCell,
  makeRouterLinksOrEmpty,
  makeBoundServicesCell,
} from '../../../../utils/table-formatters';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);
const openCreateRoute = () => router.push(createLocation.value);

const pending = ref(true);

// Global state
// Touch stateDisplay and meta to ensure reactivity with _MERGE polling that replaces all properties.
const rows = computed(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.APP) as any[];

  all.forEach((row: any) => { void row.stateDisplay; void row.meta; });

  return [...all];
});

// Groups all apps by namespace, respecting the active namespace filter.
const groupedByNamespace = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cacheKey = store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;
  const groups: Record<string, any[]> = {};

  rows.value.forEach((app: any) => {
    const namespace = app.meta?.namespace || 'default';
    if (!activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[namespace]) {
      if (!groups[namespace]) groups[namespace] = [];
      groups[namespace].push(app);
    }
  });

  return groups;
});

// Sorted list of namespaces that have at least one app.
const namespacesWithApps = computed(() =>
  Object.keys(groupedByNamespace.value)
    .filter(ns => groupedByNamespace.value[ns].length > 0)
    .sort()
);

// Responsive columns
// Touch windowWidth to trigger recomputation on resize

const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

const allColumns = [
  {
    field:     'stateDisplay',
    label:     'State',
    width:     '125px',
    formatter: (_value: string, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '180px',
    link:  (row: any) => {
      try { return router.resolve(row.detailLocation).href; } catch { return '#'; }
    }
  },
  { field: 'deployment.status', label: 'Status', width: '75px' },
  {
    field:     'route',
    label:     'Routes',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeAppRoutesCell(row)
  },
  {
    field:     'boundConfigs',
    label:     'Bound Configs',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeRouterLinksOrEmpty(row.allConfigurations, router)
  },
  {
    field:     'boundServices',
    label:     'Bound Services',
    width:     '180px',
    sortable:  false,
    formatter: (_value: any, row: any) => makeBoundServicesCell(row, router)
  },
  { field: 'deployment.username', label: 'Last Deployed By', width: '150px' },
  { field: 'meta.createdAt',      label: 'Age',              width: '50px', formatter: 'age' }
];

const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1700) hide.add('deployment.username');
  if (w < 1500) hide.add('deployment.status');
  if (w < 1275) { hide.add('boundConfigs'); hide.add('boundServices'); }
  if (w < 1100) hide.add('meta.createdAt');
  if (w < 875)  hide.add('route');

  return allColumns.filter(col => !hide.has(col.field));
});

// Per-namespace search
// Stores the search query for each namespace group. Keys are namespace names, values are the current search query for that namespace.

const searchQueries = ref<Record<string, string>>({});

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function getFilteredApps(apps: any[], namespace: string): any[] {
  const query = (searchQueries.value[namespace] || '').toLowerCase().trim();

  if (!query) return apps;

  return apps.filter(app =>
    columns.value.some((col: { field: string }) => {
      const value = String(getNestedValue(app, col.field) ?? '');

      return value.toLowerCase().includes(query);
    })
  );
}

const handleNavigate = (event: CustomEvent) => router.push(event.detail.url);

// Lifecycle
// Initial fetch of all apps, then start polling.

onMounted(async () => {
  window.addEventListener('resize', onResize);

  // ONE global fetch: no page params so backend returns all apps.
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });

  // Non-blocking: needed for bound-resource columns.
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;

  startPolling(['namespaces', 'applications', 'configurations', 'services'], store);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling(['namespaces', 'applications', 'configurations', 'services']);
});
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          variant="primary"
          size="large"
          @click="openCreateRoute"
        >
          {{ t('generic.create') }}
        </trailhand-button>
      </template>
    </Masthead>

    <div
      v-for="ns in namespacesWithApps"
      :key="ns"
      class="namespace-group"
    >
      <div class="namespace-group-header">
        <h3 class="namespace-header">
          Namespace: <span class="namespace-name">{{ ns }}</span>
        </h3>
        <input
          v-model="searchQueries[ns]"
          type="text"
          class="namespace-search-input"
          placeholder="Search..."
        >
      </div>

      <trailhand-table
        :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
        :rows="getFilteredApps(groupedByNamespace[ns], ns)"
        :columns="columns"
        :searchable="false"
        @navigate="handleNavigate"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.namespace-group {
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }

  trailhand-table {
    --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
    overflow-wrap: anywhere;
  }
}

.namespace-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
}

.namespace-header {
  font-size: 1.3rem;
  font-weight: 400;
  margin: 0;
  padding: 0;
  line-height: 1;
  color: var(--body-text);
  flex: 1;
  min-width: 0;

  .namespace-name {
    color: var(--link);
    font-weight: 500;
  }
}

.namespace-search-input {
  width: 100%;
  max-width: 300px;
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--input-text);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &::placeholder {
    color: var(--input-placeholder);
  }
}
</style>
