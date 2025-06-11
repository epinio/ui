import { EPINIO_PRODUCT_NAME } from '../types';

type Dictionary<T> = { [key: string]: T }

interface RootEpinioRoute {
  name: string;
  params: object;
}

export const rootEpinioRoute = (): RootEpinioRoute => ({
  name:   EPINIO_PRODUCT_NAME,
  params: { product: EPINIO_PRODUCT_NAME }
});

export const createEpinioRoute = (
  name: string, 
  params: Dictionary<string>, 
  query?: object,
): any => {
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
