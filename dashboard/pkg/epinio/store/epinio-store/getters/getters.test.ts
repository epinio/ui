import getters from './getters';

// Shell ships this as untranspiled ESM, so stand in the constants the getters use.
jest.mock('@shell/utils/namespace-filter', () => ({
  NAMESPACE_FILTER_ALL:            'all',
  NAMESPACE_FILTER_NS_FULL_PREFIX: 'ns://',
  NAMESPACE_FILTER_KINDS:          {
    DIVIDER:   'divider',
    PROJECT:   'project',
    NAMESPACE: 'namespace',
    SPECIAL:   'special',
  },
}));

describe('urlFor', () => {
  const appsSchema = {
    id:         'applications',
    links:      { collection: '/api/v1/applications' },
    attributes: { namespaced: true },
  };
  const chartsSchema = {
    id:    'appcharts',
    links: { collection: '/api/v1/appcharts' },
  };

  const makeGetters = (schema: any) => ({
    normalizeType: (type: string) => type.toLowerCase(),
    schemaFor:     jest.fn(() => schema),
    urlOptions:    (url: string) => url,
  });

  it('uses opt.url as-is without looking up a schema', () => {
    const g = makeGetters(undefined);

    expect(getters.urlFor({}, g)('applications', 'ns/app', { url: '/custom' })).toBe('/custom');
    expect(g.schemaFor).not.toHaveBeenCalled();
  });

  it('throws when the type has no schema', () => {
    expect(() => getters.urlFor({}, makeGetters(undefined))('Nope', undefined, undefined))
      .toThrow('Unknown schema for type: nope');
  });

  it('returns the collection link when there is no id', () => {
    expect(getters.urlFor({}, makeGetters(chartsSchema))('appcharts', undefined, undefined))
      .toBe('/api/v1/appcharts');
  });

  it('appends the id for non-namespaced types', () => {
    expect(getters.urlFor({}, makeGetters(chartsSchema))('appcharts', 'standard', undefined))
      .toBe('/api/v1/appcharts/standard');
  });

  it('splits a namespaced id into a namespaces/<ns>/ path', () => {
    expect(getters.urlFor({}, makeGetters(appsSchema))('applications', 'workspace/my-app', undefined))
      .toBe('/api/v1/namespaces/workspace/applications/my-app');
  });

  it('appends a namespaced id that has no namespace part', () => {
    expect(getters.urlFor({}, makeGetters(appsSchema))('applications', 'my-app', undefined))
      .toBe('/api/v1/applications/my-app');
  });

  it('runs the result through urlOptions', () => {
    const g = { ...makeGetters(chartsSchema), urlOptions: (url: string) => `${ url }?page=2` };

    expect(getters.urlFor({}, g)('appcharts', undefined, undefined)).toBe('/api/v1/appcharts?page=2');
  });
});

describe('can', () => {
  const can = (perms: any) => getters.can({}, { permissions: () => perms });

  it('is true only for granted actions', () => {
    const check = can({ app_read: true, app_delete: false });

    expect(check('app_read')).toBe(true);
    expect(check('app_delete')).toBe(false);
    expect(check('app_create')).toBe(false);
  });

  it('is false when permissions have not loaded', () => {
    expect(can(undefined)('app_read')).toBe(false);
    expect(can(null)('app_read')).toBe(false);
  });
});

describe('isAdmin', () => {
  const isAdmin = (me: any) => getters.isAdmin({ me })();

  it('is true for a global admin role', () => {
    expect(isAdmin({ roles: [{ id: 'user' }, { id: 'admin' }] })).toBe(true);
  });

  it('is false for a namespace-scoped admin', () => {
    expect(isAdmin({ roles: [{ id: 'admin', namespace: 'workspace' }] })).toBe(false);
  });

  it('is false without an admin role or before /me loads', () => {
    expect(isAdmin({ roles: [{ id: 'user' }] })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe('namespaceFilterOptions', () => {
  const ns = (name: string) => ({ id: name, nameDisplay: name, meta: { name } });
  const storeNamespaces = [ns('dev'), ns('prod'), ns('workspace')];

  const options = (state: any, args: any = {}) => {
    const g = { all: () => storeNamespaces };
    const rootGetters = { 'i18n/t': (key: string) => key };
    const out = getters.namespaceFilterOptions(state, g, {}, rootGetters)({
      divider:      (list: any[]) => list.push({ kind: 'divider' }),
      addNamespace: (list: any[], namespaces: any[]) => list.push(...namespaces),
      ...args,
    });

    // Drop the "All" special and the divider so tests can compare namespaces only.
    return { head: out.slice(0, 2), namespaces: out.slice(2) };
  };

  it('starts with the "All namespaces" option and a divider', () => {
    expect(options({}).head).toEqual([
      { id: 'all', kind: 'special', label: 'nav.ns.all' },
      { kind: 'divider' },
    ]);
  });

  it('lists every store namespace when there is no filter', () => {
    expect(options({ namespaceSearch: ['dev'] }).namespaces).toEqual(storeNamespaces);
  });

  it('lists every store namespace when filtering without search results', () => {
    expect(options({}, { filter: 'de' }).namespaces).toEqual(storeNamespaces);
  });

  it('shows server search results, stubbing namespaces not held client-side', () => {
    const { namespaces } = options({ namespaceSearch: ['dev', 'demo'] }, { filter: 'de' });

    expect(namespaces).toEqual([ns('dev'), { id: 'demo', nameDisplay: 'demo' }]);
  });

  it('keeps selected namespaces that fall outside the search, once each', () => {
    const selected = [
      { kind: 'namespace', id: 'ns://prod' },
      { kind: 'namespace', id: 'ns://dev' },
      { kind: 'namespace', meta: { name: 'workspace' } },
      { kind: 'special', id: 'all' },
    ];
    const { namespaces } = options({ namespaceSearch: ['dev'] }, { filter: 'de', selected });

    expect(namespaces.map((n: any) => n.id)).toEqual(['dev', 'prod', 'workspace']);
  });
});
