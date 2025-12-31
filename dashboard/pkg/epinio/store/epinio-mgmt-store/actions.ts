import { SCHEMA } from '@shell/config/types';
import { handleSpoofedRequest } from '@shell/plugins/dashboard-store/actions';
import { normalizeType } from '@shell/plugins/dashboard-store/normalize';
import { EPINIO_MGMT_STORE, EPINIO_PRODUCT_NAME, EPINIO_TYPES } from '../../types';

export default {

  async request({ rootGetters }: any, { opt }: any) {
    const spoofedRes = await handleSpoofedRequest(rootGetters, EPINIO_MGMT_STORE, opt, EPINIO_PRODUCT_NAME);

    if (spoofedRes) {
      return spoofedRes;
    }

    throw new Error('Not Implemented');
  },

  async onLogout({ commit }: any) {
    await commit('reset');
  },

  loadManagement(ctx: any) {
    const { state, commit, rootGetters } = ctx;

    // Use this to store non-cluster specific schemas. Cluster specific types are stored in epinio and are remove on cluster change

    if ( state.managementReady) {
      // Do nothing, it's already loaded
      return;
    }

    try {
      // Load management style schemas
      const spoofedSchemas = rootGetters['type-map/spoofedSchemas'](EPINIO_PRODUCT_NAME);
      const instances = spoofedSchemas?.find((schema: any) => schema.id === EPINIO_TYPES.CLUSTER);

      if (!instances) {
        console.warn('Epinio cluster schema not found in spoofed schemas');
        // Still mark as ready to prevent infinite retries
        commit('managementChanged', { ready: true });
        return;
      }

      const res = { data: [instances] };

      res.data.forEach((schema) => {
        if (schema) {
          schema._id = normalizeType(schema.id);
          schema._group = normalizeType(schema.attributes?.group);
        }
      });

      // Register schema in epiniomgmt store
      commit('loadAll', {
        ctx,
        type: SCHEMA,
        data: res.data.filter((s: any) => s) // Filter out any undefined entries
      });

      // Also create a schema with management.cattle.io.cluster ID for Rancher Shell compatibility
      // Rancher Shell's management store looks for this specific ID
      const managementSchema = {
        ...instances,
        id: 'management.cattle.io.cluster', // Rancher Shell expects this ID
        _id: normalizeType('management.cattle.io.cluster'),
        links: {
          collection: '/epinio/rancher/v1/management.cattle.io.cluster',
          self: '/epinio/rancher/v1/management.cattle.io.cluster'
        }
      };

      // Try to register in management store
      try {
        const { dispatch, rootState } = ctx;
        // Directly commit to management store if it exists
        if (rootState.management) {
          const managementCtx = {
            ...ctx,
            commit: (type: string, payload: any) => {
              if (type === 'loadAll' && payload.type === SCHEMA) {
                // Manually add schema to management store
                rootState.management.allSchemas = rootState.management.allSchemas || {};
                rootState.management.all = rootState.management.all || {};
                payload.data.forEach((schema: any) => {
                  if (schema && schema.id) {
                    const normalizedId = normalizeType(schema.id);
                    rootState.management.allSchemas[normalizedId] = schema;
                  }
                });
              }
            }
          };
          commit.call(managementCtx, 'loadAll', {
            ctx: managementCtx,
            type: SCHEMA,
            data: [managementSchema]
          });
        }
      } catch (e) {
        // Management store might not be available yet, that's OK
        console.debug('Could not register schema in management store (this is OK):', e);
      }

      // dispatch('loadSchemas')
      commit('managementChanged', { ready: true });
    } catch (err) {
      console.error('Error loading management schemas:', err);
      // Mark as ready anyway to prevent infinite retries
      commit('managementChanged', { ready: true });
    }
  },

  watch() {
  }
};
