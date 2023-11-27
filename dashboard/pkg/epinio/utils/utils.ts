export const STANDALONE_RANCHER_ENV = 'epinio';

export const isStandalone = (): boolean => {
  return process.env.rancherEnv === STANDALONE_RANCHER_ENV;
};

/**
 * In standalone world it's Epinio, in embedded world Application Engine
 */
export function getProductNameLabel(): string {
  if (isStandalone()) {
    return 'epinio.label';
  }

  return 'product.epinio';
}

/**
 * In standalone world it's Epinio, in embedded world Application Engine
 */
export function getProductName(t: (label: string) => string): string {
  return t(getProductNameLabel());
}
