// Don't forget to create a VueJS page called index.vue in the /pages folder!!!
import Dashboard from '../pages/index.vue';
import { EPINIO_PRODUCT_NAME } from '../types';

// import ViewResource from '@shell/pages/c/_cluster/_product/_resource/_id.vue';
import ViewResource from '../pages/c/_cluster/viewresource/index.vue';

const BLANK_CLUSTER = '_';
const CUSTOM_PAGE_NAME = 'page1';

const routes = [
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster`,
    path: `/${EPINIO_PRODUCT_NAME}/c/:cluster`,
    component: Dashboard,
    meta: {
      product: EPINIO_PRODUCT_NAME,
      cluster: BLANK_CLUSTER,
      pkg: EPINIO_PRODUCT_NAME,
    },
  },
  {
    name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-view-resource`,
    path:      `/:product/c/:cluster/viewresource`,
    component: ViewResource,
    meta:      { product: EPINIO_PRODUCT_NAME },
  },
];

export default routes;