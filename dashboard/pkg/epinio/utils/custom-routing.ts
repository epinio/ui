import { EPINIO_PRODUCT_NAME } from '../types';

type Dictionary<T> = { [key: string]: T }

const BLANK_CLUSTER = '_';

export const rootEpinioRoute = () => ({
  name:   EPINIO_PRODUCT_NAME,
  params: { 
    product: EPINIO_PRODUCT_NAME,
    cluster: BLANK_CLUSTER,
  }
});

export const createEpinioRoute = (name: string, params: Dictionary<string>, query?: Object) => {
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
