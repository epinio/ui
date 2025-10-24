import { IPlugin } from '@shell/core/types';
import { EPINIO_PRODUCT_NAME} from "./types";

export function init($plugin: IPlugin, store: any) {
  const BLANK_CLUSTER = '_';
  const VIEW_RESOURCE_PAGE_NAME = 'View Resource';

  const { product, virtualType, basicType } = $plugin.DSL(store, EPINIO_PRODUCT_NAME);

  product({
    icon: 'gear',
    inStore: 'management',
    weight: 100,
    to: {
      name: `${EPINIO_PRODUCT_NAME}-c-cluster`,
      path: `/${EPINIO_PRODUCT_NAME}/c/:cluster/dashboard`,
      params: {
        product: EPINIO_PRODUCT_NAME,
        cluster: BLANK_CLUSTER,
        pkg: EPINIO_PRODUCT_NAME,
      },
    },
  });



  // creating a custom page
  virtualType({
    labelKey: 'some.translation.key',
    name:     VIEW_RESOURCE_PAGE_NAME,
    route:    {
      name:   `${ EPINIO_PRODUCT_NAME }-c-cluster-view-resource`,
      params: { product: EPINIO_PRODUCT_NAME }
    }
  });

  // registering the defined pages as side-menu entries
  basicType([VIEW_RESOURCE_PAGE_NAME]);

}