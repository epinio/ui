<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { DataTableColumn, DataTableRow, SortDirection } from './types';
import { dataTableFormatters } from './types';
import ActionMenu from '@shell/components/ActionMenuShell.vue';
import { useStore } from 'vuex';

interface Props {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  rowsPerPage?: number;
  searchable?: boolean;
  sortable?: boolean;
  paginated?: boolean;
  loading?: boolean;
  keyField?: string;
  rowActions?: boolean;
  rowActionsWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rowsPerPage: 10,
  searchable: true,
  sortable: true,
  paginated: true,
  loading: false,
  keyField: 'id',
  rowActions: true,
  rowActionsWidth: 40
});

// Define slot types - using Record<string, any> for row to allow dynamic properties
defineSlots<{
  [key: `cell:${string}`]: (props: { row: Record<string, any>; value: any; column: DataTableColumn }) => any;
  empty: () => any;
}>();

// State
const searchQuery = ref('');
const currentPage = ref(1);
const sortColumn = ref<string | null>(null);
const sortDirection = ref<SortDirection>('asc');
const store = useStore();

// Apply namespace filter first
const namespaceFilteredRows = computed<DataTableRow[]>(() => {
  // Access the cache key to trigger namespace filter changes
  const cacheKey = store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  // If no namespace filter exists, or if it's empty (no namespaces loaded yet), show all rows
  if (!activeNamespaces || Object.keys(activeNamespaces).length === 0) {
    return props.rows;
  }

  // Filter rows by namespace
  return props.rows.filter((row: any) => {
    const namespace = row.meta?.namespace;
    // If row has no namespace, show it by default
    if (!namespace) {
      return true;
    }
    // Check if this namespace is in the active filter
    return activeNamespaces[namespace];
  });
});

// Computed: Filtered rows based on search
const filteredRows = computed<DataTableRow[]>(() => {
  if (!searchQuery.value || !props.searchable) {
    return namespaceFilteredRows.value;
  }

  const query = searchQuery.value.toLowerCase();
  return namespaceFilteredRows.value.filter(row => {
    return props.columns.some(column => {
      if (column.searchable === false) {
        return false;
      }
      const value = getNestedValue(row, column.field);
      return String(value).toLowerCase().includes(query);
    });
  });
});

// Computed: Sorted rows
const sortedRows = computed<DataTableRow[]>(() => {
  if (!sortColumn.value || !props.sortable) {
    return filteredRows.value;
  }

  const column = props.columns.find(col => col.field === sortColumn.value);
  if (!column || column.sortable === false) {
    return filteredRows.value;
  }

  return [...filteredRows.value].sort((a, b) => {
    const aValue = getNestedValue(a, sortColumn.value!);
    const bValue = getNestedValue(b, sortColumn.value!);

    // Handle custom sort function
    if (column.sortFn) {
      return column.sortFn(a, b, sortDirection.value);
    }

    // Default sorting logic
    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sortDirection.value === 'asc' ? comparison : -comparison;
  });
});

// Computed: Paginated rows
const paginatedRows = computed<DataTableRow[]>(() => {
  if (!props.paginated) {
    return sortedRows.value;
  }

  const start = (currentPage.value - 1) * props.rowsPerPage;
  const end = start + props.rowsPerPage;
  return sortedRows.value.slice(start, end);
});

// Computed: Total pages
const totalPages = computed(() => {
  if (!props.paginated) {
    return 1;
  }
  return Math.ceil(sortedRows.value.length / props.rowsPerPage);
});

// Computed: Pagination info
const paginationInfo = computed(() => {
  const start = (currentPage.value - 1) * props.rowsPerPage + 1;
  const end = Math.min(currentPage.value * props.rowsPerPage, sortedRows.value.length);
  return {
    start,
    end,
    total: sortedRows.value.length
  };
});

// Methods
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function formatValue(row: DataTableRow, column: DataTableColumn): any {
  const value = getNestedValue(row, column.field);

  if (column.formatter) {
    // If formatter is a string, use dataTableFormatters
    if (typeof column.formatter === 'string') {
      const formatter = dataTableFormatters[column.formatter as keyof typeof dataTableFormatters];
      if (formatter) {
        return formatter(value);
      }
    } else {
      // Otherwise, use custom formatter function
      return column.formatter(value, row);
    }
  }

  return value;
}

function handleSort(columnField: string) {
  const column = props.columns.find(col => col.field === columnField);
  if (!column || column.sortable === false || !props.sortable) {
    return;
  }

  if (sortColumn.value === columnField) {
    // Toggle direction
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn.value = columnField;
    sortDirection.value = 'asc';
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

function nextPage() {
  goToPage(currentPage.value + 1);
}

function prevPage() {
  goToPage(currentPage.value - 1);
}

function getRowKey(row: DataTableRow, index: number): string {
  return row[props.keyField] || `row-${index}`;
}

// Watch: Reset to page 1 when search or sort changes
watch([searchQuery, sortColumn, sortDirection], () => {
  currentPage.value = 1;
});

// Expose methods for parent components
defineExpose({
  goToPage,
  nextPage,
  prevPage,
  resetSearch: () => { searchQuery.value = ''; },
  resetSort: () => { sortColumn.value = null; sortDirection.value = 'asc'; }
});
</script>

<template>
  <div class="data-table">
    <!-- Search bar -->
    <div v-if="searchable" class="data-table__search">
      <input
        v-model="searchQuery"
        type="text"
        class="data-table__search-input"
        placeholder="Search..."
      >
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="data-table__loading">
      <div class="data-table__spinner" />
      <span>Loading...</span>
    </div>

    <!-- Table -->
    <div v-else class="data-table__wrapper">
      <table class="data-table__table">
        <thead class="data-table__thead">
          <tr>
            <th
              v-for="column in columns"
              :key="column.field"
              :class="{
                'data-table__th': true,
                'data-table__th--sortable': sortable && column.sortable !== false,
                'data-table__th--sorted': sortColumn === column.field
              }"
              :style="{ width: column.width }"
              @click="handleSort(column.field)"
            >
              <div class="data-table__th-content">
                <span>{{ column.label }}</span>
                <span
                  v-if="sortable && column.sortable !== false"
                  class="data-table__sort-icon"
                >
                  <i
                    v-if="sortColumn === column.field"
                    :class="{
                      'icon': true,
                      'icon-sort-down': sortDirection === 'desc',
                      'icon-sort-up': sortDirection === 'asc'
                    }"
                  />
                  <i v-else class="icon icon-sort" />
                </span>
              </div>
            </th>
            <th
              v-if="rowActions"
              class="data-table__th data-table__th--actions"
              :style="{ width: `${rowActionsWidth}px` }"
            />
          </tr>
        </thead>
        <tbody class="data-table__tbody">
          <tr
            v-for="(row, index) in paginatedRows"
            :key="getRowKey(row, index)"
            class="data-table__tr"
          >
            <td
              v-for="column in columns"
              :key="column.field"
              class="data-table__td"
            >
              <!-- Custom cell slot -->
              <slot
                :name="`cell:${column.field}`"
                :row="row"
                :value="getNestedValue(row, column.field)"
                :column="column"
              >
                <!-- Default cell rendering -->
                {{ formatValue(row, column) }}
              </slot>
            </td>
            <td
              v-if="rowActions"
              class="data-table__td data-table__td--actions"
            >
              <ActionMenu
                :resource="row"
                :data-testid="`data-table-${String(index)}-action-button`"
              />
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="paginatedRows.length === 0" class="data-table__empty">
            <td :colspan="rowActions ? columns.length + 1 : columns.length" class="data-table__td--empty">
              <slot name="empty">
                <span class="text-muted">
                  {{ searchQuery ? 'No results found' : 'No data available' }}
                </span>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="paginated && !loading && totalPages > 1" class="data-table__pagination">
      <div class="data-table__pagination-info">
        {{ paginationInfo.start }}-{{ paginationInfo.end }} of {{ paginationInfo.total }}
      </div>
      <div class="data-table__pagination-controls">
        <button
          class="data-table__pagination-btn"
          :disabled="currentPage === 1"
          @click="prevPage"
        >
          <i class="icon icon-chevron-left" />
        </button>

        <span class="data-table__pagination-current">
          {{ currentPage }} / {{ totalPages }}
        </span>

        <button
          class="data-table__pagination-btn"
          :disabled="currentPage === totalPages"
          @click="nextPage"
        >
          <i class="icon icon-chevron-right" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.data-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;

  &__search {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 0;
  }

  &__search-input {
    width: 100%;
    max-width: 300px;
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

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: var(--body-text);
  }

  &__spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  &__wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    background-color: var(--body-bg);
  }

  &__thead {
    background-color: var(--sortable-table-header-bg);
    border-bottom: 1px solid var(--border);
  }

  &__th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--body-text);
    white-space: nowrap;
    border-bottom: 1px solid var(--border);

    &--sortable {
      cursor: pointer;
      user-select: none;

      &:hover {
        background-color: var(--sortable-table-header-hover-bg);
      }
    }

    &--sorted {
      background-color: var(--sortable-table-header-sorted-bg);
    }

    &--actions {
      width: 40px;
      padding: 0.75rem 0.5rem;
    }
  }

  &__th-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__sort-icon {
    display: flex;
    align-items: center;
    color: var(--muted);

    .icon {
      font-size: 14px;
    }
  }

  &__tbody {
    background-color: var(--body-bg);
  }

  &__tr {
    border-bottom: 1px solid var(--border);

    &:hover {
      background-color: var(--sortable-table-hover-bg);
    }

    &:last-child {
      border-bottom: none;
    }
  }

  &__td {
    padding: 0.75rem 1rem;
    color: var(--body-text);

    &--empty {
      text-align: center;
      padding: 2rem;
    }

    &--actions {
      width: 40px;
      padding: 0.5rem;
      text-align: center;
      vertical-align: middle;
    }

    // Badge state styling
    :deep(.badge-state) {
      display: inline-block;
      max-width: 100%;
      position: relative;
      max-width: 110px;
      font-size: .85em;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__empty {
    &:hover {
      background-color: transparent;
    }
  }

  &__pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__pagination-info {
    color: var(--muted);
    font-size: 13px;
  }

  &__pagination-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__pagination-current {
    color: var(--body-text);
    font-size: 13px;
    min-width: 60px;
    text-align: center;
  }

  &__pagination-btn {
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

    .icon {
      font-size: 16px;
    }

    &:hover:not(:disabled) {
      background-color: var(--sortable-table-hover-bg);
      border-color: var(--link);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .text-muted {
    color: var(--muted);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
