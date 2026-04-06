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

const openCreateRoute = () => {
  router.push(createLocation.value);
};

const rows = computed(() => store.getters['epinio/all'](resource));

const windowWidth = ref(window.innerWidth);
const onResize = () => { windowWidth.value = window.innerWidth; };

// Group applications by namespace
const groupedByNamespace = computed(() => {
  // Access the cache key to trigger namespace filter changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cacheKey = store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  const groups: Record<string, any[]> = {};

  rows.value.forEach((app: any) => {
    const namespace = app.meta?.namespace || 'default';

    if (!activeNamespaces || Object.keys(activeNamespaces).length === 0 || activeNamespaces[namespace]) {
      if (!groups[namespace]) {
        groups[namespace] = [];
      }
      groups[namespace].push(app);
    }
  });

  if (Object.keys(groups).length === 0) {
    groups['workspace'] = [];
  }

  return groups;
});

const pending = ref(true);

// Per-namespace search queries (keyed by namespace name)
const searchQueries = ref<Record<string, string>>({});

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function getFilteredApps(apps: any[], namespace: string): any[] {
  const query = (searchQueries.value[namespace] || '').toLowerCase().trim();

  if (!query) {
    return apps;
  }

  return apps.filter(app =>
    columns.value.some((col: { field: string }) => {
      const value = String(getNestedValue(app, col.field) ?? '');

      return value.toLowerCase().includes(query);
    })
  );
}

// Define all possible columns with their properties and formatters. 
// We'll filter this list based on window width to determine which columns to show.
const allColumns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '125px',
    formatter: (_value: string, row: any) => makeStateTag(row)
  },
  {
    field: 'nameDisplay',
    label: 'Name',
    width: '225px',
    link: (row: any) => {
      try {
        return router.resolve(row.detailLocation).href;
      } catch {
        return '#';
      }
    }
  },
  {
    field: 'deployment.status',
    label: 'Status',
    width: '75px',
  },
  {
    field: 'route',
    label: 'Routes',
    width: '225px',
    sortable: false,
    formatter: (_value: any, row: any) => makeAppRoutesCell(row)
  },
  {
    field: 'boundConfigs',
    label: 'Bound Configs',
    width: '200px',
    sortable: false,
    formatter: (_value: any, row: any) => makeRouterLinksOrEmpty(row.allConfigurations, router)
  },
  {
    field: 'boundServices',
    label: 'Bound Services',
    width: '200px',
    sortable: false,
    formatter: (_value: any, row: any) => makeBoundServicesCell(row, router)
  },
  {
    field: 'deployment.username',
    label: 'Last Deployed By',
    width: '150px',
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    width: '75px',
    formatter: 'age'
  }
];

// Drop lower-priority columns at smaller window widths to avoid horizontal scrolling.
//   < 900px : State, Name, Status
//   < 1100px: + Routes
//   < 1300px: + Age, Last Deployed By
//  >= 1300px: all columns
const columns = computed(() => {
  const w = windowWidth.value;
  const hide = new Set<string>();

  if (w < 1300) {
    hide.add('boundConfigs');
    hide.add('boundServices');
  }
  if (w < 1100) {
    hide.add('route');
    hide.add('deployment.username');
    hide.add('meta.createdAt');
  }
  if (w < 900) {
    hide.add('deployment.status');
  }

  return allColumns.filter(col => !hide.has(col.field));
});

// Handle internal navigation events emitted by trailhand-table link cells
const handleNavigate = (event: CustomEvent) => {
  const { url } = event.detail;

  router.push(url);
};

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  // Non-blocking fetch
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;
  startPolling(
    [
      'namespaces',
      'applications',
      'configurations',
      'services',
    ],
    store
  );
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  stopPolling([
    'namespaces',
    'applications',
    'configurations',
    'services'
  ]);
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
      v-for="(apps, namespace) in groupedByNamespace"
      :key="namespace"
      class="namespace-group"
    >
      <div class="namespace-group-header">
        <h3 class="namespace-header">
          Namespace: <span class="namespace-name">{{ namespace }}</span>
        </h3>
        <input
          v-model="searchQueries[namespace]"
          type="text"
          class="namespace-search-input"
          placeholder="Search..."
        >
      </div>

      <trailhand-table
        :ref="(el: any) => { if (el) el.renderActions = makeActionMenu; }"
        :rows="getFilteredApps(apps, String(namespace))"
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

  // Map Rancher shell's hover variable name to what trailhand-table expects
  // CSS custom properties inherit into shadow DOM, fixing the dark mode white flash
  trailhand-table {
    --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
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
