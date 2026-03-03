<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

import { startPolling, stopPolling } from '../../../../utils/polling';

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
    columns.some(col => {
      const value = String(getNestedValue(app, col.field) ?? '');

      return value.toLowerCase().includes(query);
    })
  );
}

// Map application state to trailhand-tag variant
function stateToTagVariant(state: string): string {
  switch (state) {
    case 'running': return 'success';
    case 'error': return 'error';
    case 'building': return 'warning';
    case 'created': return 'info';
    default: return 'default';
  }
}
// Map application state to trailhand icon name
function stateToIcon(state: string): string {
  switch (state) {
    case 'running': return 'play';
    case 'error': return 'error';
    case 'building': return 'pause';
    case 'created': return 'rocket';
    default: return 'bug';
  }
}

const columns = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '130px',
    formatter: (_value: string, row: any) => {
      const tag = document.createElement('trailhand-tag') as any;

      tag.label = row.stateDisplay || '';
      tag.variant = stateToTagVariant(row.state);
      tag.size = 'md';
      tag.icon = stateToIcon(row.state);

      return tag;
    }
  },
  {
    field: 'nameDisplay',
    label: 'Name',
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
    label: 'Status'
  },
  {
    field: 'route',
    label: 'Routes',
    sortable: false,
    formatter: (_value: any, row: any) => {
      if (!row.routes?.length) {
        const empty = document.createElement('span');

        empty.innerHTML = '&nbsp;';

        return empty;
      }

      const span = document.createElement('span');

      span.style.wordBreak = 'break-word';

      row.routes.forEach((route: string, index: number) => {
        const url = `https://${ route }`;

        if (row.state === 'running') {
          const a = document.createElement('a');

          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer nofollow';
          a.textContent = url;
          span.appendChild(a);
        } else {
          const s = document.createElement('span');

          s.textContent = url;
          span.appendChild(s);
        }

        if (index < row.routes.length - 1) {
          span.appendChild(document.createTextNode(', '));
        }
      });

      return span;
    }
  },
  {
    field: 'boundConfigs',
    label: 'Bound Configs',
    sortable: false,
    formatter: (_value: any, row: any) => {
      if (!row.allConfigurations?.length) {
        const empty = document.createElement('span');

        empty.innerHTML = '&nbsp;';

        return empty;
      }

      const span = document.createElement('span');

      row.allConfigurations.forEach((config: any, index: number) => {
        const a = document.createElement('a');

        try {
          a.href = router.resolve(config.detailLocation).href;
        } catch {
          a.href = '#';
        }

        a.addEventListener('click', (e) => {
          e.preventDefault();
          router.push(config.detailLocation);
        });

        a.textContent = config.meta.name;
        span.appendChild(a);

        if (index < row.allConfigurations.length - 1) {
          span.appendChild(document.createTextNode(', '));
        }
      });

      return span;
    }
  },
  {
    field: 'boundServices',
    label: 'Bound Services',
    sortable: false,
    formatter: (_value: any, row: any) => {
      const services = row.services?.length ? row.services : null;
      const configServices = !services && row.configuration?.services?.length
        ? row.configuration.services
        : null;

      if (!services && !configServices) {
        const empty = document.createElement('span');

        empty.innerHTML = '&nbsp;';

        return empty;
      }

      const span = document.createElement('span');

      if (services) {
        services.forEach((service: any, index: number) => {
          const a = document.createElement('a');

          try {
            a.href = router.resolve(service.detailLocation).href;
          } catch {
            a.href = '#';
          }

          a.addEventListener('click', (e) => {
            e.preventDefault();
            router.push(service.detailLocation);
          });

          a.textContent = service.meta.name;
          span.appendChild(a);

          if (index < services.length - 1) {
            span.appendChild(document.createTextNode(', '));
          }
        });
      } else if (configServices) {
        configServices.forEach((service: string, index: number) => {
          const s = document.createElement('span');

          s.textContent = service;
          span.appendChild(s);

          if (index < configServices.length - 1) {
            span.appendChild(document.createTextNode(', '));
          }
        });
      }

      return span;
    }
  },
  {
    field: 'deployment.username',
    label: 'Last Deployed By'
  },
  {
    field: 'meta.createdAt',
    label: 'Age',
    formatter: 'age'
  }
];

// Row actions using trailhand action-menu web component
const renderActionsFunc = (row: any) => {
  const el = document.createElement('action-menu') as any;

  el.resource = row;

  // Transform string action names to callable functions
  el.actions = (row.availableActions || []).map((action: any) => {
    if (action.divider || typeof action.action !== 'string') {
      return action;
    }

    const actionName = action.action;

    return {
      ...action,
      action: () => row[actionName]?.()
    };
  });

  return el;
};

// Handle internal navigation events emitted by data-table link cells
const handleNavigate = (event: CustomEvent) => {
  const { url } = event.detail;

  router.push(url);
};

onMounted(async () => {
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

      <data-table
        :ref="(el: any) => { if (el) el.renderActions = renderActionsFunc; }"
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

  // Map Rancher shell's hover variable name to what trailhand data-table expects
  // CSS custom properties inherit into shadow DOM, fixing the dark mode white flash
  data-table {
    --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
    --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
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
