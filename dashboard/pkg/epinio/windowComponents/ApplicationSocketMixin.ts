import { useStore } from 'vuex';
import { ref, computed } from 'vue';

import { EPINIO_MGMT_STORE, EPINIO_PRODUCT_NAME, EPINIO_TYPES } from '../types';
import { App } from '../models/application/ui-types';
import { isSameOriginEpinioApi } from '../utils/standalone-api';

export function useApplicationSocketMixin(props: { application: App, endpoint: string, initialInstance: string }) {
  const store = useStore();
  const socket = ref<any>(null);
  const isOpen = ref<boolean>(false);
  const backlog = ref<Array<any>>([]);

  const instanceChoices = computed(() => {
    if (!props.application?.deployment?.replicas) {
      return [];
    }
    return Object.keys(props.application.deployment.replicas);
  });

  const getRootSocketUrl = async () => {
    const { token } = await store.dispatch(
      `epinio/request`,
      { opt: { url: '/api/v1/authtoken' } },
    );

    const isSingleProduct = !!store.getters['isSingleProduct'];
    let api = '';
    let prependPath = '';

    if (isSingleProduct) {
      if (await isSameOriginEpinioApi()) {
        api = `${ window.location.protocol }//${ window.location.host }`;
      } else {
        const cnsi = store.getters[`${ EPINIO_PRODUCT_NAME }/singleProductCNSI`]();

        prependPath = `/pp/v1/direct/ws/${ cnsi?.guid }`;
      }
    } else {
      const currentClusterId = store.getters['clusterId'];
      const currentCluster = store.getters[`${ EPINIO_MGMT_STORE }/byId`](
        EPINIO_TYPES.CLUSTER,
        currentClusterId,
      );

      api = currentCluster.api;
    }

    return {
      url: `${ api }${ prependPath }${ props.endpoint }`.replace(/^http/, 'ws'),
      token
    };
  }

  return {
    socket,
    isOpen,
    backlog,
    instanceChoices,
    getRootSocketUrl,
  };
};
