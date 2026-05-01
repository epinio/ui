<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';

import AppModal from '../../../../components/application/AppModal.vue';
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
import EpinioApplicationModel from 'models/applications';
import { overrideTableRows } from '../../../../utils/table-formatters';

const store = useStore();
const router = useRouter();
const t = store.getters['i18n/t'];

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));
const appModal = ref<InstanceType<typeof AppModal> | null>(null);

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);

const pending = ref(true);

// ── Global store rows ────────────────────────────────────────────────────────
// ONE global findAll seeds the initial display instantly (no page params →
// backend returns all apps). Touch reactive properties so _MERGE polling
// updates that mutate items in-place are tracked by Vue.
const rows = computed(() => {
  const all = store.getters['epinio/all'](EPINIO_TYPES.APP) as any[];

  all.forEach((row: any) => { void row.stateDisplay; void row.meta; });

  return [...all];
});

// Groups all apps by namespace respecting the active namespace filter.
const groupedByNamespace = computed(() => {
  void store.state.activeNamespaceCacheKey;
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

// Per-namespace pagination state

type PaginationMeta = { page: number; pageSize: number; totalItems: number; totalPages: number };

const namespaceRows         = ref<Record<string, any[]>>({});
const namespaceLoading      = ref<Record<string, boolean>>({});
const namespaceMeta         = ref<Record<string, PaginationMeta | null>>({});
const namespaceCurrentPages = ref<Record<string, number>>({});

// Returns the best available rows for a namespace: namespace-specific once
// fetched, global store rows before that (instant initial display).
function getDisplayRows(ns: string): any[] {
  return namespaceRows.value[ns] ?? groupedByNamespace.value[ns] ?? [];
}

// silent=true → skip loading overlay (polling and background meta seeding)
async function fetchNamespaceApps(namespace: string, page = 1, silent = false) {
  if (!silent) {
    namespaceLoading.value = { ...namespaceLoading.value, [namespace]: true };
  }
  namespaceCurrentPages.value = { ...namespaceCurrentPages.value, [namespace]: page };

  try {
    const { items, meta } = await store.dispatch('epinio/findAppsInNamespace', { namespace, page });

    namespaceRows.value = { ...namespaceRows.value, [namespace]: items };
    namespaceMeta.value = { ...namespaceMeta.value, [namespace]: meta };
  } finally {
    if (!silent) {
      namespaceLoading.value = { ...namespaceLoading.value, [namespace]: false };
    }
  }
}

async function handlePageChange(event: CustomEvent, namespace: string) {
  await fetchNamespaceApps(namespace, event.detail.page);
}

// Only render namespace groups that have apps in either source.
const namespacesWithApps = computed(() => {
  const fromGlobal   = Object.keys(groupedByNamespace.value).filter(ns => groupedByNamespace.value[ns].length > 0);
  const fromSpecific = Object.keys(namespaceRows.value).filter(ns => (namespaceRows.value[ns]?.length ?? 0) > 0);

  return [...new Set([...fromGlobal, ...fromSpecific])].sort();
});

// Responsive columns

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

const searchQueries = ref<Record<string, string>>({});

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function getFilteredApps(apps: any[], namespace: string): any[] {
  const query = (searchQueries.value[namespace] || '').toLowerCase().trim();

  const overrideProps = [
    {
      prop: 'availableActions',
      value: (row: EpinioApplicationModel) => {
        const actions = [...row.availableActions];
        const goToEditIndex = actions.findIndex((a: any) => a.action === 'goToEdit');
        const newAction = {
            action: 'goToEdit',
            label: 'Edit',
            enabled: true
          };
        if (goToEditIndex !== -1) {
          actions.splice(goToEditIndex, 1, newAction);
        } else {
          actions.push(newAction);
        }
        return actions;
      },
      conditionFn: (row: EpinioApplicationModel) => {
        return true;
      },
    },
    {
      prop: 'goToEdit',
      value: (row: EpinioApplicationModel) => () => {
        appModal.value?.openEdit(row);
      },
      conditionFn: (row: EpinioApplicationModel) => {
        return true;
      }, 
    }
  ];

  if (!query) {
    return overrideTableRows(apps, overrideProps);
    return apps;
  }

  const filteredApps = apps.filter(app =>
    columns.value.some((col: { field: string }) => {
      const value = String(getNestedValue(app, col.field) ?? '');

      return value.toLowerCase().includes(query);
    })
  );

  return overrideTableRows(filteredApps, overrideProps);
  return filteredApps;
}

const handleNavigate = (event: CustomEvent) => router.push(event.detail.url);

// Lifecycle

// Applications are never loaded via the unpaginated findAll. They come in
// exclusively through findAppsInNamespace (per-namespace, paginated).
let appsPollIntervalId: number | undefined;
const APPS_POLL_RATE_MS = 30000;

function visibleNamespaceNames(): string[] {
  return (store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE) as any[])
    .map((ns: any) => ns.meta?.name)
    .filter((n: string) => !!n);
}

onMounted(async () => {
  window.addEventListener('resize', onResize);

  pending.value = false;

  // Seed each namespace's first paginated page. loadCluster has already
  // awaited findAll(NAMESPACE), so the list is available.
  visibleNamespaceNames().forEach(ns => fetchNamespaceApps(ns, 1, false));
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  // Poll supporting resources
  startPolling(['namespaces', 'configurations', 'services'], store);

  if (store.$router.currentRoute._value.query.mode === 'openModal') {
    appModal.value?.openCreate();
  }

  // Poll apps per namespace at their current page.
  appsPollIntervalId = window.setInterval(() => {
    visibleNamespaceNames().forEach(ns => {
      fetchNamespaceApps(ns, namespaceCurrentPages.value[ns] ?? 1, true);
    });
  }, APPS_POLL_RATE_MS);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling(['namespaces', 'configurations', 'services']);
  if (appsPollIntervalId !== undefined) {
    window.clearInterval(appsPollIntervalId);
  }
});
</script>

<template>
  <Loading v-if="pending" />
  <div class="outlet" v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
    >
      <template #createButton>
        <trailhand-button
          variant="primary"
          size="large"
          @click="appModal?.openCreate()"
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

      <!--
        server-side becomes true once per-namespace meta arrives.
        Until then the table shows up to 10 global rows with no pagination
        controls (never more than one page worth). Loading overlay only
        appears on explicit user-initiated page changes, not polling.
      -->
      <trailhand-table
        :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
        :rows="getFilteredApps(getDisplayRows(ns), ns)"
        :columns="columns"
        :searchable="false"
        :server-side="!!namespaceMeta[ns]"
        :total-items="namespaceMeta[ns]?.totalItems ?? 0"
        :current-page="namespaceCurrentPages[ns] ?? 1"
        :loading="namespaceLoading[ns] ?? false"
        @navigate="handleNavigate"
        @page-change="(e: CustomEvent) => handlePageChange(e, ns)"
      />
    </div>
    <AppModal ref="appModal" />
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
