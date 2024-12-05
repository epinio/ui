
import { RouteConfig } from 'vue-router';

import { BLANK_CLUSTER } from '../config/epinio';
import { EPINIO_PRODUCT_NAME } from '../types';

import CreateApp from '../pages/c/_cluster/applications/createapp/index.vue';
import ListApp from '../pages/c/_cluster/applications/index.vue';
import ListEpinio from '../pages/index.vue';
import Dashboard from '../pages/c/_cluster/dashboard.vue';
import AboutEpinio from '../pages/c/_cluster/about.vue';
import ListEpinioResource from '../pages/c/_cluster/_resource/index.vue';
import CreateEpinioResource from '../pages/c/_cluster/_resource/create.vue';
import ViewEpinioResource from '../pages/c/_cluster/_resource/_id.vue';
import ViewEpinioNsResource from '../pages/c/_cluster/_resource/_namespace/_id.vue';
import AuthVerify from '../pages/auth/verify.vue';

const meta = {
  product: EPINIO_PRODUCT_NAME,
  pkg:     EPINIO_PRODUCT_NAME
};

const routes = [{
  name:      `${ EPINIO_PRODUCT_NAME }-auth-verify`,
  path:      `/:product/auth/verify`,
  component: AuthVerify,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-dashboard`,
  path:      `/:product/c/:cluster/dashboard`,
  component: Dashboard,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-applications-createapp`,
  path:      `/:product/c/:cluster/applications/createapp`,
  component: CreateApp,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-applications`,
  path:      `/:product/c/:cluster/applications`,
  component: ListApp,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-about`,
  path:      `/:product/c/:cluster/about`,
  component: AboutEpinio,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-resource`,
  path:      `/:product/c/:cluster/:resource`,
  component: ListEpinioResource,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-resource-create`,
  path:      `/:product/c/:cluster/:resource/create`,
  component: CreateEpinioResource,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-resource-id`,
  path:      `/:product/c/:cluster/:resource/:id`,
  component: ViewEpinioResource,
  meta
}, {
  name:      `${ EPINIO_PRODUCT_NAME }-c-cluster-resource-namespace-id`,
  path:      `/:product/c/:cluster/:resource/:namespace/:id`,
  component: ViewEpinioNsResource,
  meta
}];

const isEpinioSingleProduct = process.env.rancherEnv === 'epinio';

if (!isEpinioSingleProduct) {
  routes.unshift({
    name:      `${ EPINIO_PRODUCT_NAME }`,
    path:      `/:product/`,
    component: ListEpinio,
    meta:      {
      product: EPINIO_PRODUCT_NAME,
      cluster: BLANK_CLUSTER,
      pkg:     EPINIO_PRODUCT_NAME
    }
  });
}

export default routes;
