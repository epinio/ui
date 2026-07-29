import { METRIC, SCHEMA, WORKLOAD_TYPES } from '@shell/config/types';
import { handleSpoofedRequest } from '@shell/plugins/dashboard-store/actions';
import { classify } from '@shell/plugins/dashboard-store/classify';
import { normalizeType } from '@shell/plugins/dashboard-store/normalize';
import { NAMESPACE_FILTERS } from '@shell/store/prefs';
import { createNamespaceFilterKeyWithId } from '@shell/utils/namespace-filter';
import { parse as parseUrl, stringify as unParseUrl } from '@shell/utils/url';
import epinioAuth, { EpinioAuthTypes } from '../../utils/auth';

import {
  EpinioInfo,
  EpinioVersion,
  EPINIO_MGMT_STORE,
  EPINIO_PRODUCT_NAME,
  EPINIO_STANDALONE_CLUSTER_NAME,
  EPINIO_TYPES,
  EpinioMe
} from '../../types';
import EpinioCluster from '../../models/epiniomgmt/epinio.io.management.cluster';
import { RedirectToError } from '@shell/utils/error';
import { allHashSettled } from '@shell/utils/promise';
import { SetPaginationPagePayload } from './types';
import { buildPermissionsFromRoles } from '../../utils/permissions';

const createId = (schema: any, resource: any) => {
  const name = resource.meta?.name || resource.name;
  const namespace = resource.meta?.namespace || resource.namespace;

  if (schema?.attributes?.namespaced && namespace) {
    return `${ namespace }/${ name }`;
  }

  return name;
};

const semanticVersionRegex = /v(?:(\d+)\.)?(?:(\d+)\.)?(?:(\d+)\.\d+)/;

// Debounce timer for the navbar namespace search. Module-scoped so it
// coalesces across dispatches (Vuex actions get a fresh context each call and
// can't hold their own debounce state).
let namespaceSearchTimer: ReturnType<typeof setTimeout> | null = null;

export const epiniofy = (obj: any, schema: any, type: any) => ({
  ...obj,
  // Note - these must be applied here ... so things that need an id before classifying have access to them
  id: createId(schema, obj),
  type,
});

export default {

  watch() {
    return Promise.resolve();
  },

  remove({ commit }: any, obj: any ) {
    commit('remove', obj);
  },

  // Navbar namespace filter search. Debounced, prefix-matches server-side via
  // /namespacematches and stores the resulting names. An empty query clears the
  // stored results (null), so the filter falls back to the full list.
  searchNamespaces({ dispatch, commit }: any, query: string) {
    if (namespaceSearchTimer) {
      clearTimeout(namespaceSearchTimer);
      namespaceSearchTimer = null;
    }

    if (!query?.length) {
      commit('setNamespaceSearch', null);

      return;
    }

    namespaceSearchTimer = setTimeout(async() => {
      try {
        const res = await dispatch('request', {
          opt: {
            url:          `/api/v1/namespacematches/${ query }`,
            method:       'GET',
            responseType: 'json'
          }
        });

        commit('setNamespaceSearch', res.data?.names || []);
      } catch {
        commit('setNamespaceSearch', []);
      }
    }, 200);
  },

  async request(context: any, {
    opt, type, clusterId, growlOnError = false
  }: any) {
    const { rootGetters, dispatch, getters, commit } = context;

    const spoofedRes = await handleSpoofedRequest(rootGetters, EPINIO_PRODUCT_NAME, opt, EPINIO_PRODUCT_NAME);

    if (spoofedRes) {
      return spoofedRes;
    }

    opt.url = opt.url.replace(/\/*$/g, '');

    const isSingleProduct = rootGetters['isSingleProduct'];

    let ps = Promise.resolve(opt?.prependPath);

    if (isSingleProduct) {
      if (opt?.prependPath === undefined) {
        ps = dispatch('findSingleProductCNSI').then((cnsi: any) => `/pp/v1/direct/r/${ cnsi?.guid }`);
      }
    } else {
      ps = dispatch(`${ EPINIO_MGMT_STORE }/findAll`, { type: EPINIO_TYPES.CLUSTER }, { root: true }).then(() => '');
    }

    // opt.httpsAgent = new https.Agent({ rejectUnauthorized: false });

    return await ps
      .then(async(prependPath = opt?.prependPath) => {
        if (isSingleProduct) {
          if (opt.url.startsWith('/')) {
            opt.url = prependPath + opt.url;
          } else {
            const url = parseUrl(opt.url);

            if (!url.path.startsWith(prependPath)) {
              url.path = prependPath + url.path;
              opt.url = unParseUrl(url);
            }
          }
        } else {
          const currentClusterId = clusterId || rootGetters['clusterId'];
          const currentCluster: EpinioCluster = rootGetters[`${ EPINIO_MGMT_STORE }/byId`](EPINIO_TYPES.CLUSTER, currentClusterId);

          if (currentCluster.createAuthConfig) {
            opt.headers = {
              ...opt.headers,
              Authorization: await epinioAuth.authHeader(currentCluster.createAuthConfig(EpinioAuthTypes.AGNOSTIC))
            };
          }

          opt.url = `${ currentCluster.api }${ opt.url }`;
        }

        return (this as any).$axios(opt);
      })
      .then((res) => {
        if ( opt.depaginate ) {
          throw Error('depaginate not supported');
        }

        if ( opt.responseType ) {
          return res;
        } else {
          const out = res.data || {};
          const schema = getters.schemaFor(type);

          if (Array.isArray(out)) {
            // Non-paginated collection
            res.data = { data: out.map((o) => epiniofy(o, schema, type)) };
          } else if (Array.isArray((out as any).items)) {
            // Paginated collection: unwrap items but preserve pagination metadata
            const items = (out as any).items;
            const pagination = {
              page:       (out as any).page,
              pageSize:   (out as any).pageSize,
              totalItems: (out as any).totalItems,
              totalPages: (out as any).totalPages
            };

            // Allow callers to opt out of updating global pagination state
            // (e.g. per-namespace fetches that maintain their own meta)
            if (!opt._skipPaginationMeta) {
              commit('setPaginationMeta', { type, meta: pagination });
            }

            res.data = {
              data:        items.map((o: any) => epiniofy(o, schema, type)),
              _pagination: pagination
            };
          } else {
            // Single resource: `find` action turns this into `{data: out}`
            res.data = epiniofy(out, schema, type);
          }

          return responseObject(res);
        }
      }).catch((err) => {
        if ( !err || !err.response ) {
          return Promise.reject(err);
        }

        const res = err.response;

        // Go to the logout page for 401s, unless redirectUnauthorized specifically disables (for the login page)
        if ( opt.redirectUnauthorized !== false && res.status === 401 ) {
          if (isSingleProduct) {
            dispatch('auth/logout', opt.logoutOnError, { root: true });
          } else {
            return Promise.reject(new RedirectToError('Auth failed, return user to epinio cluster list', `/epinio`));
          }
        } else if (growlOnError) {
          dispatch('growl/fromError', { title: `Epinio Request to ${ opt.url }`, err }, { root: true });
        }

        if ( typeof res.data !== 'undefined' ) {
          return Promise.reject(responseObject(res));
        }

        return Promise.reject(err);
      });

    function responseObject(res: any) {
      let out = res.data;

      if (typeof out === 'string') {
        out = {};
      }

      if ( res.status === 204 || out === null || typeof out === 'string') {
        out = {};
      }

      Object.defineProperties(out, {
        _status:     { value: res.status },
        _statusText: { value: res.statusText },
        _headers:    { value: res.headers },
        _req:        { value: res.request },
        _url:        { value: opt.url },
      });

      return out;
    }
  },

  redirect(ctx: any, location: any) {
    const router = (this as any).$router;

    router.replace(location);
  },

  async onLogout({ dispatch, commit }: any) {
    await dispatch(`unsubscribe`);
    await commit('reset');
  },

  loadSchemas: async( ctx: any ) => {
    const { commit, dispatch, rootGetters } = ctx;

    const clusterId = rootGetters['clusterId'];

    const res = {
      data: [{
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.APP,
        type:              'schema',
        links:             { collection: '/api/v1/applications' },
        collectionMethods: ['get', 'post'],
        resourceFields:    { },
        attributes:        { namespaced: true }
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.APP_CHARTS,
        type:              'schema',
        links:             { collection: '/api/v1/appcharts' },
        collectionMethods: ['get', 'post'],
        resourceFields:    { },
        attributes:        { namespaced: true }
      },
      {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.BUILDER_IMAGE,
        type:              'schema',
        links:             { collection: '/api/v1/builderimages' },
        collectionMethods: ['get', 'post'],
        resourceFields:    { },
        attributes:        { namespaced: true }
      },
      {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.GIT_CONFIG,
        type:              'schema',
        links:             { collection: '/api/v1/gitconfigs' },
        collectionMethods: ['get', 'post'],
        resourceFields:    { },
        attributes:        { namespaced: true }
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.NAMESPACE,
        type:              'schema',
        links:             { collection: '/api/v1/namespaces' },
        collectionMethods: ['post', 'get'],
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.CATALOG_SERVICE,
        type:              'schema',
        links:             { collection: '/api/v1/catalogservices' },
        collectionMethods: ['get', 'post'],
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.SERVICE_INSTANCE,
        type:              'schema',
        links:             { collection: '/api/v1/services' },
        collectionMethods: ['get', 'post'],
        attributes:        { namespaced: true }
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.APP_INSTANCE,
        type:              'schema',
        links:             { collection: '/api/v1/na' },
        collectionMethods: ['get'],
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.CONFIGURATION,
        type:              'schema',
        links:             { collection: '/api/v1/configurations' },
        collectionMethods: ['get', 'post'],
        resourceFields:    { },
        attributes:        { namespaced: true }
      }]
    };

    const spoofedSchemas = rootGetters['type-map/spoofedSchemas'](EPINIO_PRODUCT_NAME);
    const excludeInstances = spoofedSchemas.filter((schema: any) => schema.id !== EPINIO_TYPES.CLUSTER);

    const data = [
      ...res.data,
      ...excludeInstances,
    ];

    const isSingleProduct = ctx.getters['isSingleProduct'];

    if (!isSingleProduct) {
      try {
        const schemas = await allHashSettled({
          nodeMetrics: dispatch(
            `cluster/request`,
            { url: `/k8s/clusters/${ clusterId }/v1/schemas/${ METRIC.NODE }` },
            { root: true }
          ),
          deployments: dispatch(
            `cluster/request`,
            { url: `/k8s/clusters/${ clusterId }/v1/schemas/${ WORKLOAD_TYPES.DEPLOYMENT }` },
            { root: true }
          )
        });

        Object.values(schemas).forEach((res: any ) => {
          if (res.value) {
            data.push(res.value);
          }
        });
      } catch (e) {
        console.debug(`Unable to fetch schema/s for epinio cluster: ${ clusterId }`, e);
      }
    }

    data.forEach((schema: any) => {
      schema._id = normalizeType(schema.id);
      schema._group = normalizeType(schema.attributes?.group);
    });

    commit('loadAll', {
      ctx,
      type: SCHEMA,
      data
    });
  },

  loadCluster: async( { dispatch, commit, rootGetters }: any, { id }: any ) => {
    await dispatch(`loadSchemas`);
    await dispatch(`findAll`, { type: EPINIO_TYPES.NAMESPACE });
    await dispatch('cleanNamespaces', null, { root: true });

    const key = createNamespaceFilterKeyWithId(id, EPINIO_PRODUCT_NAME);
    const filters = rootGetters['prefs/get'](NAMESPACE_FILTERS)?.[key] || [];

    commit('updateNamespaces', { filters }, { root: true });
  },

  findSingleProductCNSI: async( { dispatch, commit, getters }: any ) => {
    const singleProductCNSI = getters['singleProductCNSI']();

    if (singleProductCNSI) {
      return singleProductCNSI;
    }

    const { data: endpoints } = await dispatch('request', {
      opt: {
        url:         '/endpoints',
        prependPath: '/pp/v1'
      }
    });
    const cnsi = endpoints?.find((e: any) => e.name === EPINIO_STANDALONE_CLUSTER_NAME);

    if (!cnsi) {
      console.warn('Unable to find the CNSI guid of the Epinio Endpoint');
    }

    commit('singleProductCNSI', cnsi);

    return cnsi;
  },

  createNamespace(ctx: any, obj: { name : string }) {
    // Note - created model save --> create
    return classify(ctx, {
      type: EPINIO_TYPES.NAMESPACE,
      meta: { name: obj.name }
    });
  },

  version: async( { dispatch, getters }: any ): Promise<EpinioVersion> => {
    const storedVersion = getters['version']();

    if (storedVersion) {
      return storedVersion;
    }

    await dispatch('info');

    return getters['version']();
  },

  info: async( { dispatch, commit, getters }: any ): Promise<EpinioInfo> => {
    const storedInfo = getters['info']();

    if (storedInfo) {
      return storedInfo;
    }

    const info = await dispatch('request', { opt: { url: `/api/v1/info` } });
    const version = {
      displayVersion: info.version.match(semanticVersionRegex)?.[0] ?? 'v1.7.0',
      fullVersion:    info.version ?? 'v1.7.0',
    };

    commit('info', info);
    commit('version', version);

    return info;
  },


  /**
   * Fetch page 1 of apps for every namespace in a single server call.
   * Returns a map of namespace → { items, meta } matching findAppsInNamespace's shape.
   * Falls back to an empty map on error so the UI can degrade gracefully.
   */
  findGroupedApps: async(
    ctx: any,
    { page = 1, pageSize = 10, search = '' }: {
      page?: number;
      pageSize?: number;
      search?: string
    } = {}
  ) => {
    const { dispatch } = ctx;
    let url = `/api/v1/applications/grouped?page=${ page }&pageSize=${ pageSize }`;
    if (search) {
      url += `&search=${ encodeURIComponent(search) }`;
    }

    // The request action runs epiniofy on the response, which spreads the namespace
    // map and injects id/type keys. The guard below skips those non-namespace entries.
    const grouped: Record<string, any> =
      await dispatch('request', { opt: { url, _skipPaginationMeta: true } }) ?? {};

    const appSchema = ctx.getters.schemaFor(EPINIO_TYPES.APP);
    const result: Record<string, { items: any[]; meta: any }> = {};
    for (const [ns, nsData] of Object.entries(grouped)) {
      if (!nsData || typeof nsData !== 'object' || !Array.isArray((nsData as any).items)) {
        continue;
      }
      const items = (nsData.items ?? []).map((item: any) =>
        classify(ctx, epiniofy(item, appSchema, EPINIO_TYPES.APP))
      );
      result[ns] = {
        items,
        meta: {
          page:       nsData.page,
          pageSize:   nsData.pageSize,
          totalItems: nsData.totalItems,
          totalPages: nsData.totalPages,
        },
      };
    }

    return result;
  },

  /**
   * Fetch a single page of applications scoped to a specific namespace.
   * Does NOT touch global paginationMeta so per-namespace tables stay independent.
   * Returns { items: any[], meta: { page, pageSize, totalItems, totalPages } | null }
   */
  findAppsInNamespace: async(ctx: any, { namespace, page = 1, search = '' }: { namespace: string; page?: number; search?: string }) => {
    const { dispatch } = ctx;
    let url = `/api/v1/namespaces/${ namespace }/applications?page=${ page }&pageSize=10`;
    if (search) {
      url += `&search=${ search }`;
    }

    const result = await dispatch('request', {
      opt: {
        url:                 url,
        _skipPaginationMeta: true,
      },
      type: EPINIO_TYPES.APP,
    });

    const rawItems: any[] = result?.data ?? [];

    // classify() instantiates the proper model class so computed properties
    // (stateDisplay, nameDisplay, detailLocation, allConfigurations, etc.)
    // are available for the column formatters, same as what findAll does.
    const items = rawItems.map((item: any) => classify(ctx, item));

    return {
      items,
      meta: result?._pagination ?? null,
    };
  },

  goToPage: async({ commit, dispatch }: any, { type, page }: SetPaginationPagePayload) => {
    commit('setPaginationPage', { type, page });
    await dispatch('findAll', { type, opt: { force: true } });
  },

  /**
   * Re-fetch the current page of a list and resync its pagination meta.
   *
   * Use this after any create/delete instead of a single-resource `find`.
   * A `find` only adds/updates one entry in the store slice, which leaves
   * `paginationMeta.totalItems` at whatever the last list fetch reported: the
   * table renders every row it is handed as the current page, so the extra
   * rows pile onto the current page and the page count never moves until the
   * background poller happens to re-fetch.
   *
   * If a delete emptied the page we are sitting on, step back to the new last
   * page so the user is not left looking at a page that no longer exists.
   */
  refreshList: async({ commit, dispatch, getters }: any, { type }: { type: string }) => {
    await dispatch('findAll', { type, opt: { force: true } });

    const meta = getters['paginationMeta'](type);
    const page = getters['currentPaginationPage'](type);

    if (!meta || meta.totalPages < 1 || page <= meta.totalPages) {
      return;
    }

    commit('setPaginationPage', { type, page: meta.totalPages });
    await dispatch('findAll', { type, opt: { force: true } });
  },

  search: async({ commit, dispatch }: any, { type, query }: { type: string; query: string }) => {
    commit('setSearchQuery', { type, query });
    commit('setPaginationPage', { type, page: 1 });
    commit('clearAll', type);  // clear before fetch so merge starts from empty
    await dispatch('findAll', { type, opt: { force: true } });
  },

  me: async({ dispatch, commit }: any): Promise<EpinioMe> => {
    // Always fetch fresh so permissions reflect the current user (no stale cache after login switch)
    const me = await dispatch('request', { opt: { url: `/api/v1/me` } });
    const permissions = buildPermissionsFromRoles(me.roles || []);

    commit('me', me);
    commit('permissions', permissions);

    return me;
  },

};