import { rootEpinioRoute, createEpinioRoute } from './custom-routing';

describe('rootEpinioRoute', () => {
  it('points at the epinio product', () => {
    expect(rootEpinioRoute()).toEqual({ name: 'epinio', params: { product: 'epinio' } });
  });
});

describe('createEpinioRoute', () => {
  it('prefixes the name and merges params with the product', () => {
    expect(createEpinioRoute('c-cluster-applications', { cluster: 'local' })).toEqual({
      name:   'epinio-c-cluster-applications',
      params: { product: 'epinio', cluster: 'local' },
    });
  });

  it('spreads extra fields onto the route', () => {
    const route = createEpinioRoute('c-cluster', { cluster: 'local' }, { query: { tab: 'logs' } });

    expect(route.query).toEqual({ tab: 'logs' });
  });

  it('lets params override the product', () => {
    expect(createEpinioRoute('x', { product: 'other' }).params.product).toBe('other');
  });
});
