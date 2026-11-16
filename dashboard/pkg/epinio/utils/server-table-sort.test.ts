import { ref } from 'vue';
import {
  DEFAULT_SORT_FIELD_MAP,
  patchTrailhandServerSort,
  serverSortNoop,
  withServerSideSort,
} from './server-table-sort';
import type { ListResourceRequestParams } from '../models/resource/ui-types';

describe('DEFAULT_SORT_FIELD_MAP', () => {
  it.each([
    ['nameDisplay', 'name'],
    ['meta.name', 'name'],
    ['name', 'name'],
    ['meta.createdAt', 'createdAt'],
    ['createdAt', 'createdAt'],
    ['age', 'createdAt'],
    ['meta.namespace', 'namespace'],
    ['namespace', 'namespace'],
    ['stateDisplay', 'status'],
    ['status', 'status'],
    ['deployment.status', 'deploymentStatus'],
    ['deployment.username', 'username'],
    ['buildStatus', 'buildStatus'],
    ['builtImageUrl', 'builtImageUrl'],
    ['configuration.user', 'username'],
    ['configuration.variableCount', 'variableCount'],
    ['catalogServiceVersion', 'catalogServiceVersion'],
    ['appCount', 'appCount'],
    ['configCount', 'configCount'],
    ['description', 'description'],
    ['image', 'image'],
    ['helmChart', 'helmChart'],
    ['provider', 'provider'],
    ['url', 'url'],
  ])('maps %s -> %s', (columnField, apiField) => {
    expect(DEFAULT_SORT_FIELD_MAP[columnField]).toBe(apiField);
  });
});

describe('serverSortNoop', () => {
  it('always returns 0 so client page order stays as the server sent it', () => {
    expect(serverSortNoop()).toBe(0);
  });
});

describe('withServerSideSort', () => {
  it('attaches serverSortNoop to sortable columns without an existing sortFn', () => {
    const columns = withServerSideSort([
      { field: 'meta.name' },
      { field: 'meta.createdAt' },
    ]);

    expect(columns[0].sortFn).toBe(serverSortNoop);
    expect(columns[1].sortFn).toBe(serverSortNoop);
  });

  it('leaves columns with sortable:false unchanged', () => {
    const columns = withServerSideSort([
      { field: 'route', sortable: false },
    ]);

    expect(columns[0].sortable).toBe(false);
    expect(columns[0].sortFn).toBeUndefined();
  });

  it('preserves an existing sortFn', () => {
    const custom = () => 1;
    const columns = withServerSideSort([
      { field: 'meta.name', sortFn: custom },
    ]);

    expect(columns[0].sortFn).toBe(custom);
  });
});

describe('patchTrailhandServerSort', () => {
  const makeTable = (sortDirection: 'asc' | 'desc' = 'asc') => {
    const original = jest.fn(function(this: any, _field: string) {
      this._sortDirection = sortDirection;
    });

    return {
      _sortDirection: 'asc' as 'asc' | 'desc',
      _handleSort:    original,
      original,
    };
  };

  it('no-ops when the table or _handleSort is missing', () => {
    const params = ref<ListResourceRequestParams>({ page: 2 });

    expect(() => patchTrailhandServerSort(null, params)).not.toThrow();
    expect(() => patchTrailhandServerSort({}, params)).not.toThrow();
    expect(params.value).toEqual({ page: 2 });
  });

  it('patches only once', () => {
    const table = makeTable();
    const params = ref<ListResourceRequestParams>({ page: 2, search: 'x' });
    const firstHandler = table._handleSort;

    patchTrailhandServerSort(table, params);
    const patched = table._handleSort;

    patchTrailhandServerSort(table, params);

    expect(table._handleSort).toBe(patched);
    expect(table._handleSort).not.toBe(firstHandler);
  });

  it('updates sort/sortDir and resets page for a mapped column', () => {
    const table = makeTable('desc');
    const params = ref<ListResourceRequestParams>({
      page:     3,
      pageSize: 10,
      search:   'app',
    });

    patchTrailhandServerSort(table, params);
    table._handleSort('meta.name');

    expect(table.original).toHaveBeenCalledWith('meta.name');
    expect(params.value).toEqual({
      page:     1,
      pageSize: 10,
      search:   'app',
      sort:     'name',
      sortDir:  'desc',
    });
  });

  it('defaults sortDir to asc when direction is not desc', () => {
    const table = makeTable('asc');
    const params = ref<ListResourceRequestParams>({ page: 2 });

    patchTrailhandServerSort(table, params);
    table._handleSort('meta.createdAt');

    expect(params.value.sort).toBe('createdAt');
    expect(params.value.sortDir).toBe('asc');
    expect(params.value.page).toBe(1);
  });

  it('does not change request params for unmapped columns', () => {
    const table = makeTable('desc');
    const params = ref<ListResourceRequestParams>({ page: 2, search: 'x' });

    patchTrailhandServerSort(table, params);
    table._handleSort('boundConfigs');

    expect(table.original).toHaveBeenCalledWith('boundConfigs');
    expect(params.value).toEqual({ page: 2, search: 'x' });
  });

  it('uses a custom field map when provided', () => {
    const table = makeTable('asc');
    const params = ref<ListResourceRequestParams>({ page: 4 });

    patchTrailhandServerSort(table, params, { customCol: 'customApi' });
    table._handleSort('customCol');

    expect(params.value).toEqual({
      page:    1,
      sort:    'customApi',
      sortDir: 'asc',
    });
  });
});
