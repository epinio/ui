import { CoreStoreSpecifics, CoreStoreConfig } from '@shell/core/types';

import getters from './getters';
import mutations from './mutations';
import actions from './actions';

import { EPINIO_PRODUCT_NAME } from '../../types';

const epinioFactory = (): CoreStoreSpecifics => {
  return {
    state() {
      return {
        // Current page (1-based) per resource type for paginated list requests
        paginationPage: {} as Record<string, number>,
        // Last pagination meta from API (totalPages, totalItems, etc.) per resource type
        paginationMeta: {} as Record<string, { page: number; pageSize: number; totalItems: number; totalPages: number }>,
      };
    },

    getters: {
      ...getters
    },

    mutations: { ...mutations },

    actions: {
      ...actions
    },
  };
};
const config: CoreStoreConfig = {
  namespace:      EPINIO_PRODUCT_NAME,
  isClusterStore: true
};

/**
 * `epinio` store is like a `cluster` store...
 * .. it contains epinio instance specific resources that should be setup/reset when navigating to/away from an epinio instances
 */
export default {
  specifics: epinioFactory(),
  config
};
