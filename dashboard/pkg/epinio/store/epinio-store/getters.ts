import { EPINIO_TYPES } from '../../types';
import {
  NAMESPACE_FILTER_ALL as ALL,
  NAMESPACE_FILTER_KINDS
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

  urlOptions: (state: any) => (url: any) => {
    // Apply default pagination for key Epinio collection endpoints to reduce payload size.
    const pathToType: Record<string, string> = {
      '/api/v1/applications':    EPINIO_TYPES.APP,
      '/api/v1/appcharts':       EPINIO_TYPES.APP_CHARTS,
      '/api/v1/namespaces':      EPINIO_TYPES.NAMESPACE,
      '/api/v1/configurations':  EPINIO_TYPES.CONFIGURATION,
      '/api/v1/services':        EPINIO_TYPES.SERVICE_INSTANCE,
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

      const qs = params.toString();

      return qs ? `${ path }?${ qs }` : path;
    }

    return url;
  },

  paginationMeta: (state: any) => (type: string) => state.paginationMeta?.[type] ?? null,

  currentPaginationPage: (state: any) => (type: string) => state.paginationPage?.[type] ?? 1,

  namespaceFilterOptions: (state: any, getters: any, rootState: any, rootGetters: any) => ({
    addNamespace,
    divider
  }: any) => {
    const out = [{
      id:    ALL,
      kind:  NAMESPACE_FILTER_KINDS.SPECIAL,
      label: rootGetters['i18n/t']('nav.ns.all'),
    }];

    divider(out);
    addNamespace(out, getters.all(EPINIO_TYPES.NAMESPACE));

    return out;
  },

  singleProductCNSI: (state: any) => () => state.singleProductCNSI,

  info: (state: any) => () => state.info,

  version: (state: any) => () => state.version,
};
