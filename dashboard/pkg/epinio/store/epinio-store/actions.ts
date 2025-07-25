import { METRIC, SCHEMA, WORKLOAD_TYPES } from '@shell/config/types';
import { handleSpoofedRequest } from '@shell/plugins/dashboard-store/actions';
import { classify } from '@shell/plugins/dashboard-store/classify';
import { normalizeType } from '@shell/plugins/dashboard-store/normalize';
import { NAMESPACE_FILTERS } from '@shell/store/prefs';
import { createNamespaceFilterKeyWithId } from '@shell/utils/namespace-filter';
import { parse as parseUrl, stringify as unParseUrl } from '@shell/utils/url';
import epinioAuth, { EpinioAuthTypes } from '../../utils/auth';

import {
  EpinioInfo, EpinioVersion, EPINIO_MGMT_STORE, EPINIO_PRODUCT_NAME, EPINIO_STANDALONE_CLUSTER_NAME, EPINIO_TYPES
} from '../../types';
import EpinioCluster from '../../models/epiniomgmt/cluster';
import { RedirectToError } from '@shell/utils/error';
import { allHashSettled } from '@shell/utils/promise';

const createId = (schema: any, resource: any) => {
  const name = resource.meta?.name || resource.name;
  const namespace = resource.meta?.namespace || resource.namespace;

  if (schema?.attributes?.namespaced && namespace) {
    return `${ namespace }/${ name }`;
  }

  return name;
};

const semanticVersionRegex = /v(?:(\d+)\.)?(?:(\d+)\.)?(?:(\d+)\.\d+)/;

export const epiniofy = (obj: any, schema: any, type: any) => ({
  ...obj,
  // Note - these must be applied here ... so things that need an id before classifying have access to them
  id: createId(schema, obj),
  type,
});

export default {

  remove({ commit }: any, obj: any ) {
    commit('remove', obj);
  },

  async request(context: any, {
    opt, type, clusterId, growlOnError = false
  }: any) {
    const { rootGetters, dispatch, getters } = context;

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
            res.data = { data: out.map((o) => epiniofy(o, schema, type)) };
          } else {
            // `find` action turns this into `{data: out}`
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
        collectionMethods: ['get'],
        resourceFields:    { },
      }, {
        product:           EPINIO_PRODUCT_NAME,
        id:                EPINIO_TYPES.NAMESPACE,
        type:              'schema',
        links:             { collection: '/api/v1/namespaces' },
        collectionMethods: ['get', 'post'],
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
    dispatch(`findAll`, { type: EPINIO_TYPES.APP }); // This is used often, get a kick start
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

};
