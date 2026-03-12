<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

import DataTable from '../../../../components/tables/DataTable.vue';
import type { DataTableColumn } from '../../../../components/tables/types';
import Loading from '@shell/components/Loading';
import Masthead from '@shell/components/ResourceList/Masthead';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';

import { EPINIO_TYPES } from '../../../../types';
import { createEpinioRoute } from '../../../../utils/custom-routing';

import { startPolling, stopPolling } from '../../../../utils/polling';

const store = useStore();
const t = store.getters['i18n/t'];

const resource = EPINIO_TYPES.APP;
const schema = ref(store.getters['epinio/schemaFor'](resource));

const createLocation = computed(() =>
  createEpinioRoute('c-cluster-applications-createapp', { cluster: store.getters['clusterId'] })
);

const openCreateRoute = () => {
  store.$router.push(createLocation.value);
};

const rows = computed(() => store.getters['epinio/all'](resource));

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));

const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

// Match DataTable-style range text: "1-10 of 30"
const paginationRange = computed(() => {
  const meta = paginationMeta.value;
  if (!meta) {
    return { start: 0, end: 0, total: 0 };
  }
  const start = (currentPage.value - 1) * meta.pageSize + 1;
  const end = Math.min(currentPage.value * meta.pageSize, meta.totalItems);
  return { start, end, total: meta.totalItems };
});

function goToPage(page: number) {
  const meta = paginationMeta.value;
  if (meta && (page < 1 || page > meta.totalPages)) {
    return;
  }
  store.dispatch('epinio/goToPage', { type: resource, page });
}

// Group applications by namespace
const groupedByNamespace = computed(() => {
  // Access the cache key to trigger namespace filter changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cacheKey = store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  const groups: Record<string, any[]> = {};

  rows.value.forEach((app: any) => {
    const namespace = app.meta?.namespace || 'default';

    // Only include this namespace if it's in the active filter
    // If no filter is active or filter is empty, show all namespaces
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

const columns: DataTableColumn[] = [
  {
    field: 'stateDisplay',
    label: 'State',
    width: '100px'
  },
  {
    field: 'nameDisplay',
    label: 'Name'
  },
  {
    field: 'deployment.status',
    label: 'Status'
  },
  {
    field: 'route',
    label: 'Routes',
    sortable: false
  },
  {
    field: 'boundConfigs',
    label: 'Bound Configs',
    sortable: false
  },
  {
    field: 'boundServices',
    label: 'Bound Services',
    sortable: false
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

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP });
  // Non-blocking fetch
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION });
  store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  pending.value = false;
  // Removed 'catalogservices' - catalog services are static and don't need frequent polling
  // They're loaded on initial mount if needed, but don't change frequently
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
        <button
          class="btn role-primary"
          @click="openCreateRoute"
        >
          {{ t('generic.create') }}
        </button>
      </template>
    </Masthead>

    <div
      v-for="(apps, namespace) in groupedByNamespace"
      :key="namespace"
      class="namespace-group"
    >

      <DataTable
        :rows="apps"
        :columns="columns"
      >
        <template #title>
          <h3 class="namespace-header">
            Namespace: <span class="namespace-name">{{ namespace }}</span>
          </h3>
        </template>
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
        <template #cell:route="{ row }">
          <span v-if="row.routes && row.routes.length" class="route">
            <template
              v-for="(route, index) in row.routes"
              :key="route.id || route"
            >
              <a
                v-if="row.state === 'running'"
                :href="`https://${route}`"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {{ `https://${route}` }}
              </a>
              <span v-else>
                {{ `https://${route}` }}
              </span>
              <span v-if="index !== row.routes.length - 1">, </span>
            </template>
          </span>
          <span v-else class="text-muted">&nbsp;</span>
        </template>
        <template #cell:boundConfigs="{ row }">
          <span v-if="row.allConfigurations && row.allConfigurations.length">
            <template v-for="(config, index) in row.allConfigurations" :key="config.id">
              <LinkDetail
                :row="config"
                :value="config.meta.name"
              />
              <span
                v-if="index < row.allConfigurations.length - 1"
                :key="config.id + 'i'"
              >, </span>
            </template>
          </span>
          <span
            v-else
            class="text-muted"
          >&nbsp;</span>
        </template>
        <template #cell:boundServices="{ row }">
          <span v-if="row.services && row.services.length">
            <template v-for="(service, index) in row.services" :key="service.id">
              <LinkDetail
                :row="service"
                :value="service.meta.name"
              />
              <span
                v-if="index < row.services.length - 1"
                :key="service.id + 'i'"
              >, </span>
            </template>
          </span>
          <span v-else-if="row.configuration.services && row.configuration.services.length">
            <template v-for="(service, index) in row.configuration.services" :key="service">
              <span>{{ service }}</span>
              <span
                v-if="index < row.configuration.services.length - 1"
                :key="service + 'i'"
              >, </span>
            </template>
          </span>
          <span
            v-else
            class="text-muted"
          >&nbsp;</span>
        </template>
      </DataTable>
    </div>

    <!-- Pagination bar: same style as DataTable (1-10 of 30, < 1/3 >) -->
    <div
      v-if="paginationMeta && paginationMeta.totalPages > 1"
      class="data-table__pagination"
    >
      <div class="data-table__pagination-info">
        {{ paginationRange.start }}-{{ paginationRange.end }} of {{ paginationRange.total }}
      </div>
      <div class="data-table__pagination-controls">
        <button
          class="data-table__pagination-btn"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          <i class="icon icon-chevron-left" />
        </button>
        <span class="data-table__pagination-current">
          {{ currentPage }} / {{ paginationMeta.totalPages }}
        </span>
        <button
          class="data-table__pagination-btn"
          :disabled="currentPage >= paginationMeta.totalPages"
          @click="goToPage(currentPage + 1)"
        >
          <i class="icon icon-chevron-right" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.namespace-group {
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.namespace-header {
  font-size: 1.3rem;
  font-weight: 400;
  margin: 0;
  padding: 0;
  line-height: 1;
  color: var(--body-text);

  .namespace-name {
    color: var(--link);
    font-weight: 500;
  }
}

.route {
  word-break: break-word;
}

/* Match DataTable pagination bar styling */
.data-table__pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  gap: 1rem;
  flex-wrap: wrap;
}

.data-table__pagination-info {
  color: var(--muted);
  font-size: 13px;
}

.data-table__pagination-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.data-table__pagination-current {
  color: var(--body-text);
  font-size: 13px;
  min-width: 60px;
  text-align: center;
}

.data-table__pagination-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--body-bg);
  color: var(--body-text);
  cursor: pointer;
  transition: all 0.2s;
}

.data-table__pagination-btn .icon {
  font-size: 16px;
}

.data-table__pagination-btn:hover:not(:disabled) {
  background-color: var(--sortable-table-hover-bg);
  border-color: var(--link);
}

.data-table__pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
