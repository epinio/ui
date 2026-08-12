import { EPINIO_TYPES } from '../../types';
import {
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_KINDS,
  NAMESPACE_FILTER_NS_FULL_PREFIX
} from '@shell/utils/namespace-filter';

export default {

  urlFor: (state: any, getters: any) => (type: any, id: any, opt: any) => {
    opt = opt || {};
    type = getters.normalizeType(type);
    let url = opt.url;

    if ( !url ) {
      const schema = getters.schemaFor(type);

      if ( !schema ) {
        throw new Error(`Unknown schema for type: ${ type }`);
      }

      url = schema.links.collection;

      if ( id ) {
        const slash = id.indexOf('/');

        if (schema.attributes?.namespaced && slash > 0) {
          const ns = id.slice(0, slash);
          const realId = id.slice(slash + 1, id.length);
          const type = url.indexOf(schema.id);

          url = `${ url.slice(0, type) }namespaces/${ ns }/${ url.slice(type, url.length) }/${ realId }`;
        } else {
          url += `/${ id }`;
        }
      }
    }

    url = getters.urlOptions(url);

    return url;
  },

  // Ensure pagination params are included in URLs for list fetches, based on global pagination state for that type.
  // This allows pagination to work with any component that uses urlFor to generate its API URLs, without needing to explicitly pass page params from the component.
  urlOptions: (state: any) => (url: any) => {
    const pathToType: Record<string, string> = {
      '/api/v1/appcharts':      EPINIO_TYPES.APP_CHARTS,
      '/api/v1/builderimages':  EPINIO_TYPES.BUILDER_IMAGE,
      '/api/v1/gitconfigs':     EPINIO_TYPES.GIT_CONFIG,
      '/api/v1/namespaces':     EPINIO_TYPES.NAMESPACE,
      '/api/v1/configurations': EPINIO_TYPES.CONFIGURATION,
      '/api/v1/services':       EPINIO_TYPES.SERVICE_INSTANCE,
      '/api/v1/applications':   EPINIO_TYPES.APP,
      '/api/v1/catalogservices': EPINIO_TYPES.CATALOG_SERVICE,
    };

    const [path, query = ''] = String(url).split('?');

    if (path in pathToType) {
      const params = new URLSearchParams(query);
      const type = pathToType[path];
      const currentPage = state.paginationPage?.[type] ?? 1;

      if (!params.has('page')) {
        params.set('page', String(currentPage));
      }
      if (!params.has('pageSize')) {
        params.set('pageSize', '10');
      }

      const search = state.searchQuery?.[type];
      if (search) {
        params.set('search', search);
      } else {
        params.delete('search');
      }

      const namespaces = state.activeNamespaces;
      if (namespaces && namespaces.length) {
        params.set('namespaces', namespaces.join(','));
      } else {
        params.delete('namespaces');
      }

      const qs = params.toString();

      return qs ? `${ path }?${ qs }` : path;
    }

    return url;
  },

  searchQuery: (state: any) => (type: string) => state.searchQuery?.[type] ?? '',

  // Return pagination meta for the given type, or null if not set.
  // This is used by components to read pagination state for their API calls, which is managed globally in the store.
  paginationMeta: (state: any) => (type: string) => state.paginationMeta?.[type] ?? null,

  // Return the current page number for the given type, or 1 if not set.
  currentPaginationPage: (state: any) => (type: string) => state.paginationPage?.[type] ?? 1,

  // Namespace filter options for the UI. Builds an "All namespaces" special, a
  // divider, then the individual namespaces via the addNamespace/divider
  // helpers passed from the component.
  //
  // When the component passes a non-empty `filter` and server search results
  // exist (state.namespaceSearch), show those prefix matches instead of the
  // full list. The currently-selected namespaces are always unioned in so the
  // filter component's "prune values not in options" logic can't drop a
  // selection that falls outside the current search.
  namespaceFilterOptions: (state: any, getters: any, rootState: any, rootGetters: any) => ({
    addNamespace,
    divider,
    filter,
    selected = []
  }: any) => {
    const out = [{
      id:    ALL,
      kind:  NAMESPACE_FILTER_KINDS.SPECIAL,
      label: rootGetters['i18n/t']('nav.ns.all'),
    }];

    divider(out);

    const all = getters.all(EPINIO_TYPES.NAMESPACE);
    const search = state.namespaceSearch;

    let namespaces = all;

    if ((filter || '').length && search) {
      const byName = new Map(all.map((ns: any) => [ns.meta.name, ns]));

      // A namespace not held client-side still renders from a minimal stub:
      // addNamespace only reads `id` and `nameDisplay`, and namespaces are
      // cluster-scoped so both equal the name.
      const toNamespace = (name: string) =>
        byName.get(name) || { id: name, nameDisplay: name };

      // Server prefix-match results, keyed by name to dedupe.
      const names = new Map();

      search.forEach((name: string) => names.set(name, toNamespace(name)));

      // Union in currently-selected namespaces so the filter component's
      // "prune values not in options" logic can't drop a selection that falls
      // outside the current search. Selected option ids are prefixed (ns://),
      // so strip the prefix back to the bare namespace name.
      selected
        .filter((s: any) => s?.kind === NAMESPACE_FILTER_KINDS.NAMESPACE)
        .forEach((s: any) => {
          const name = typeof s.id === 'string' ?
            s.id.replace(NAMESPACE_FILTER_NS_FULL_PREFIX, '') :
            s?.meta?.name;

          if (name && !names.has(name)) {
            names.set(name, toNamespace(name));
          }
        });

      namespaces = [...names.values()];
    }

    addNamespace(out, namespaces);

    return out;
  },

  activeNamespaces: (state: any) => () => state.activeNamespaces,

  singleProductCNSI: (state: any) => () => state.singleProductCNSI,

  info: (state: any) => () => state.info,

  version: (state: any) => () => state.version,

  me: (state: any) => () => state.me,

  permissions: (state: any) => () => state.permissions,

  // Convenience helper: check if the current user has a given action permission
  can: (state: any, getters: any) => (actionId: string): boolean => {
    const perms = getters.permissions?.() || {};

    return !!perms[actionId];
  },

  // Global admin check. Mirrors the server's User.IsAdmin: a role with id
  // "admin" AND no namespace. A namespace-scoped admin (e.g. "admin:workspace",
  // which the default "epinio" user has) is NOT a global admin, so we cannot key
  // off the role id alone or the flattened permission map -- the namespaced
  // admin role carries the same actions a global admin does, which would make
  // can('namespace') wrongly true. Only the global (namespace-less) admin role
  // may create global git configs, matching the backend's 403.
  isAdmin: (state: any) => (): boolean => {
    const roles = state.me?.roles || [];

    return roles.some((role: any) => role.id === 'admin' && !role.namespace);
  },
};