<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

import { EPINIO_TYPES } from '../types';
import DataTable from '../components/tables/DataTable.vue';
import type { DataTableColumn } from '../components/tables/types';
import LinkDetail from '@shell/components/formatter/LinkDetail.vue';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter.vue';
import { useStore } from 'vuex';
import { startPolling, stopPolling } from '../utils/polling';

const pending = ref(true);
const store = useStore();
const resource = EPINIO_TYPES.SERVICE_INSTANCE;

onMounted(async () => {
  await Promise.all([
    store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.APP }),
    store.dispatch(
      `epinio/findAll`,
      { type: EPINIO_TYPES.SERVICE_INSTANCE }
    ),
  ]);
  pending.value = false;

  // Catalog services are static - only poll on initial load, not continuously
  // They're loaded above but don't need frequent updates
  startPolling(["namespaces", "applications", "services"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications", "services"]);
});

const rows = computed(() => {
  return store.getters['epinio/all'](resource);
});

const paginationMeta = computed(() => store.getters['epinio/paginationMeta'](resource));
const currentPage = computed(() => store.getters['epinio/currentPaginationPage'](resource));

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
    field: 'catalog_service',
    label: 'Catalog Service',
    sortable: false
  },
  {
    field: 'catalog_service_version',
    label: 'Catalog Service Version'
  },
  {
    field: 'boundApps',
    label: 'Bound Applications',
    sortable: false
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
    <template #cell:catalog_service="{ row }">
      <LinkDetail
        v-if="row.serviceLocation"
        :row="{ detailLocation: row.serviceLocation }"
        :value="row.catalog_service"
      />
      <span v-else>{{ row.catalog_service }}</span>
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
</template>

<style lang="scss" scoped>
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

