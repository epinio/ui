import { EPINIO_TYPES } from '../../types';

export default {
  urlFor: (state: any, getters: any, rootState: any, rootGetters: any) => (type: any, id: any, opt: any) => {
    opt = opt || {};
    type = rootGetters['type-map/normalize']?.(type) || type;
    let url = opt.url;

    if (!url) {
      // Try to get schema from getters (might not be available yet)
      let schema = null;
      try {
        schema = getters.schemaFor?.(type) || rootGetters['management/schemaFor']?.(type);
      } catch (e) {
        // Schema not available yet, that's OK
      }

      if (!schema) {
        // For spoofed types, construct URL from type - don't throw error
        // This allows Rancher Shell's loadManagement to work even if schema isn't loaded yet
        if (type === EPINIO_TYPES.CLUSTER || type === 'management.cattle.io.cluster') {
          url = '/epinio/rancher/v1/management.cattle.io.cluster';
        } else {
          // Return a default URL instead of throwing - let the request fail gracefully
          console.warn(`Schema not found for type: ${type}, using default URL`);
          url = `/epinio/rancher/v1/${type}`;
        }
      } else {
        url = schema.links?.collection || schema.links?.self;
      }

      if (id && url) {
        url += `/${id}`;
      }
    }

    return url;
  },

  urlOptions: () => (url: any) => {
    return url;
  },
};
