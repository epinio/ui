// Don't forget to create a VueJS page called index.vue in the /pages folder!!!
import ListEpinio from "../pages/index.vue";
import Dashboard from "../pages/c/_cluster/dashboard.vue";
// import { BLANK_CLUSTER } from '../config/epinio';
import { EPINIO_PRODUCT_NAME } from '../types';
import ListEpinioResource from '../pages/c/_cluster/_resource/index.vue';


// // import ViewResource from '@shell/pages/c/_cluster/_product/_resource/_id.vue';
// import ViewResource from '../pages/c/_cluster/viewresource/index.vue';

const BLANK_CLUSTER = '_';

const meta = {
  cluster: BLANK_CLUSTER,
  product: EPINIO_PRODUCT_NAME,
  pkg: EPINIO_PRODUCT_NAME,
};

const routes = [
  {
    name: `${EPINIO_PRODUCT_NAME}`,
    path: `/:product/`,
    component: ListEpinio,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-dashboard`,
    path: `/:product/c/:cluster`,
    component: Dashboard,
    meta: {
      product: EPINIO_PRODUCT_NAME,
      pkg: EPINIO_PRODUCT_NAME,
    },
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-auth-verify`,
    path: `/:product/auth/verify`,
    component: ListEpinio, //AuthVerify,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-applications-createapp`,
    path: `/:product/c/:cluster/applications/createapp`,
    component: ListEpinio, //CreateApp,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-applications`,
    path: `/:product/c/:cluster/applications`,
    component: ListEpinio, //ListApp
    meta: {
      product: EPINIO_PRODUCT_NAME,
      pkg: EPINIO_PRODUCT_NAME,
    },
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-about`,
    path: `/:product/c/:cluster/about`,
    component: ListEpinio, //AboutEpinio,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-resource`,
    path: `/:product/c/:cluster/:resource`,
    component: ListEpinioResource,
    meta: {
      product: EPINIO_PRODUCT_NAME,
      pkg: EPINIO_PRODUCT_NAME,
    },
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-resource-create`,
    path: `/:product/c/:cluster/:resource/create`,
    component: ListEpinio, //CreateEpinioResource,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-resource-id`,
    path: `/:product/c/:cluster/:resource/:id`,
    component: ListEpinio, //ViewEpinioResource,
    meta,
  },
  {
    name: `${EPINIO_PRODUCT_NAME}-c-cluster-resource-namespace-id`,
    path: `/:product/c/:cluster/:resource/:namespace/:id`,
    component: ListEpinio, //ViewEpinioNsResource,
    meta,
  },
];

const isEpinioSingleProduct = process.env.rancherEnv === "epinio";

if (!isEpinioSingleProduct) {
//   routes.unshift({
//     name: `${EPINIO_PRODUCT_NAME}`,
//     path: `/:product/`,
//     component: ListEpinio,
//     meta: {
//       product: EPINIO_PRODUCT_NAME,
//       cluster: BLANK_CLUSTER,
//       pkg: EPINIO_PRODUCT_NAME,
//     },
//   });
}

export default routes;
