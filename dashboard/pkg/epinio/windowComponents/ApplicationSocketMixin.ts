import { useStore } from 'vuex';
import { ref, computed } from 'vue';

import { EPINIO_MGMT_STORE, EPINIO_PRODUCT_NAME, EPINIO_TYPES } from '../types';

export function useApplicationSocketMixin(props: any) {
  const store = useStore();
  const socket = ref<any>(null);
  const isOpen = ref<boolean>(false);
  const backlog = ref<Array<any>>([]);

  const instanceChoices = computed(() => {
    return props.application.instances.map((instance: any) => instance.id);
  });

  const getRootSocketUrl = async () => {
    const { token } = await store.dispatch(
      `epinio/request`,
      { opt: { url: '/api/v1/authtoken' } },
    );

    const isSingleProduct = !!store.getters['isSingleProduct'];
    let api = '';
    let prependPath = '';

    console.log(store);
    if (isSingleProduct) {
      const cnsi = store.getters[`${ EPINIO_PRODUCT_NAME }/singleProductCNSI`]();

      prependPath = `/pp/v1/direct/ws/${ cnsi?.guid }`;
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
