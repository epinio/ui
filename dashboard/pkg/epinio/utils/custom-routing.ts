import { EPINIO_PRODUCT_NAME } from '../types';

import { Location } from 'vue-router';
type Dictionary<T> = { [key: string]: T }

export const rootEpinioRoute = (): Location => ({
  name:   EPINIO_PRODUCT_NAME,
  params: { product: EPINIO_PRODUCT_NAME }
});

export const createEpinioRoute = (name: string, params: Dictionary<string>, query?: Object): Location => {
  const rootParams = rootEpinioRoute().params || {};

  return {
    name:   `${ rootEpinioRoute().name }-${ name }`,
    params: {
      ...rootParams,
      ...params
    },
    ...query
  };
};
