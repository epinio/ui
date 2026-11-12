import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';
import type { ListResourceRequestParams } from '../models/resource/ui-types';

/**
 * Maps common trailhand-table column `field` values to API `sort` values.
 * Fields not listed are not sent to the server.
 */
export const DEFAULT_SORT_FIELD_MAP: Record<string, string> = {
  nameDisplay: 'name',
  'meta.name': 'name',
  name: 'name',
  'meta.createdAt': 'createdAt',
  createdAt: 'createdAt',
  age: 'createdAt',
  'meta.namespace': 'namespace',
  namespace: 'namespace',
  // Apps
  stateDisplay: 'status',
  status: 'status',
  'deployment.status': 'deploymentStatus',
  'deployment.username': 'username',
  buildStatus: 'buildStatus',
  builtImageUrl: 'builtImageUrl',
  // Configurations
  'configuration.user': 'username',
  'configuration.variableCount': 'variableCount',
  // Services
  catalogServiceVersion: 'catalogServiceVersion',
  // Namespaces
  appCount: 'appCount',
  configCount: 'configCount',
  // Builder images / app charts / gitconfigs
  description: 'description',
  image: 'image',
  helmChart: 'helmChart',
  provider: 'provider',
  url: 'url',
};

export type SortFieldMap = Record<string, string>;

/**
 * No-op client comparator. trailhand-table sorts the current page in memory on
 * header click; with server-side pagination that fights the API order.
 * Returning 0 keeps the server-provided row order while the sort icon still toggles.
 */
export const serverSortNoop = () => 0;

/**
 * Attach no-op sortFn to every column that remains sortable.
 */
export function withServerSideSort<T extends { sortable?: boolean; sortFn?: (...args: unknown[]) => number }>(
  columns: T[],
): T[] {
  return columns.map((column) => {
    if (column.sortable === false) {
      return column;
    }
    return {
      ...column,
      sortFn: column.sortFn ?? serverSortNoop,
    };
  });
}

const PATCH_FLAG = '__epinioServerSortPatched';

/**
 * Patch trailhand-table's internal `_handleSort` so every header click also
 * updates list request params (`sort` / `sortDir`) and resets to page 1.
 *
 * Click listeners on the host were unreliable (shadow DOM / ref timing);
 * hooking `_handleSort` receives the column field directly from trailhand.
 */
export function patchTrailhandServerSort(
  table: any,
  requestParams: Ref<ListResourceRequestParams>,
  fieldMap: SortFieldMap = DEFAULT_SORT_FIELD_MAP,
): void {
  if (!table || typeof table._handleSort !== 'function') {
    return;
  }
  if (table[PATCH_FLAG]) {
    return;
  }

  const original = table._handleSort.bind(table);

  table._handleSort = (columnField: string) => {
    original(columnField);

    const apiField = fieldMap[columnField];
    if (!apiField) {
      return;
    }

    const sortDir: 'asc' | 'desc' = table._sortDirection === 'desc' ? 'desc' : 'asc';

    requestParams.value = {
      ...requestParams.value,
      page: 1,
      sort: apiField,
      sortDir,
    };
  };

  table[PATCH_FLAG] = true;
}

/**
 * Keep the trailhand-table instance patched whenever the ref becomes available.
 */
export function useServerTableSort(
  requestParams: Ref<ListResourceRequestParams>,
  tableHost: Ref<any>,
  _columns?: Ref<Array<{ field: string }>> | Array<{ field: string }>,
  fieldMap: SortFieldMap = DEFAULT_SORT_FIELD_MAP,
) {
  const apply = async () => {
    await nextTick();
    patchTrailhandServerSort(tableHost.value, requestParams, fieldMap);
  };

  watch(tableHost, () => {
    apply();
  }, { immediate: true });

  onBeforeUnmount(() => {
    const table = tableHost.value;
    if (table?.[PATCH_FLAG] && typeof table._handleSort === 'function') {
      // Leave patched handler in place; element is being destroyed with the view.
      delete table[PATCH_FLAG];
    }
  });
}
