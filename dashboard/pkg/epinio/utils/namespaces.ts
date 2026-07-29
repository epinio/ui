import { computed, ref } from 'vue';
import sortBy from 'lodash/sortBy';

import { EPINIO_TYPES } from '../types';

interface UseNamespacesOptions {
  // Limit the default list to the navbar's namespace filter. Never applied to
  // search results, which the server has already scoped to what the user can see.
  scopeToActiveFilter?: boolean;
  onError?: (e: unknown) => void;
}

/**
 * Namespace options for a picker, fetched from the API with server-side name
 * filtering. The store's namespace slice only holds one page of the namespaces
 * list, so it cannot back a picker.
 */
export function useNamespaces(store: any, opts: UseNamespacesOptions = {}) {
  const namespaces = ref<any[]>([]);
  const cached = ref<any[]>([]);
  const isLoading = ref(false);

  const classify = (rawData: any[]) => Promise.all(
    rawData.map((item: any) => store.dispatch(
      'epinio/create',
      { type: EPINIO_TYPES.NAMESPACE, ...item }
    ))
  );

  const load = async (url: string) => {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url,
        method:       'GET',
        responseType: 'json'
      }
    });

    return classify(res.data ?? []);
  };

  const inActiveFilter = (rows: any[]) => {
    void store.state.activeNamespaceCacheKey;
    const active = store.state.activeNamespaceCache;

    if (!active || Object.keys(active).length === 0) {
      return rows;
    }

    return rows.filter((ns: any) => !!active[ns.meta?.name ?? ns.metadata?.name]);
  };

  // Cached, so reopening a dropdown in the same form doesn't refetch
  async function fetchAll() {
    if (cached.value.length > 0) {
      namespaces.value = cached.value;

      return;
    }

    isLoading.value = true;

    try {
      const rows = await load('/api/v1/namespaces');
      const scoped = opts.scopeToActiveFilter ? inActiveFilter(rows) : rows;

      namespaces.value = scoped;
      cached.value = scoped;
    } catch (e) {
      if (opts.onError) {
        opts.onError(e);
      } else {
        console.error('Failed to fetch namespaces', e);
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function search(query: string) {
    isLoading.value = true;

    try {
      namespaces.value = await load(
        `/api/v1/namespaces?search=${ encodeURIComponent(query) }`
      );
    } catch {
      namespaces.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  // Read-only namespace fields (view/edit) only need the record's own namespace
  // present for the label to render. Leaves the cache empty so a later create
  // still loads the full list.
  function seed(name: string) {
    namespaces.value = name ? [{ meta: { name } }] : [];
    cached.value = [];
  }

  const sorted = computed(() => sortBy(namespaces.value, (ns: any) => ns.meta?.name) as any[]);

  const options = computed(() => sorted.value.map((ns: any) => ({
    label: ns.meta?.name || '',
    value: ns.meta?.name || '',
  })));

  const firstName = computed(() => sorted.value[0]?.meta?.name || '');

  return {
    namespaces: sorted, options, isLoading, firstName, fetchAll, search, seed
  };
}
