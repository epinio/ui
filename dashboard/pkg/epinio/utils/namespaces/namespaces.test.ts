import { useNamespaces } from './namespaces';

const ns = (name: string) => ({ meta: { name } });

const makeStore = (data: any[] = [], active: Record<string, boolean> = {}) => ({
  state:    { activeNamespaceCache: active },
  dispatch: jest.fn((action: string, payload: any) => {
    if (action === 'epinio/request') {
      return Promise.resolve({ data });
    }

    // epinio/create: hand the payload back as the "model"
    return Promise.resolve(payload);
  }),
});

describe('useNamespaces', () => {
  it('fetches, sorts, and maps namespaces to options', async() => {
    const store = makeStore([ns('zeta'), ns('alpha')]);
    const { fetchAll, options, firstName } = useNamespaces(store);

    await fetchAll();

    expect(options.value).toEqual([
      { label: 'alpha', value: 'alpha' },
      { label: 'zeta', value: 'zeta' },
    ]);
    expect(firstName.value).toBe('alpha');
  });

  it('caches fetchAll results', async() => {
    const store = makeStore([ns('a')]);
    const { fetchAll } = useNamespaces(store);

    await fetchAll();
    await fetchAll();

    const requests = store.dispatch.mock.calls.filter(([action]) => action === 'epinio/request');

    expect(requests).toHaveLength(1);
  });

  it('reports fetch errors through onError', async() => {
    const store = makeStore();
    const onError = jest.fn();

    store.dispatch.mockRejectedValueOnce(new Error('boom'));

    const { fetchAll, isLoading } = useNamespaces(store, { onError });

    await fetchAll();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(isLoading.value).toBe(false);
  });

  it('url-encodes search queries', async() => {
    const store = makeStore([ns('a b')]);
    const { search, namespaces } = useNamespaces(store);

    await search('a b');

    expect(store.dispatch.mock.calls[0][1].opt.url).toBe('/api/v1/namespaces?search=a%20b');
    expect(namespaces.value).toHaveLength(1);
  });

  it('clears results when search fails', async() => {
    const store = makeStore([ns('a')]);
    const { fetchAll, search, namespaces } = useNamespaces(store);

    await fetchAll();
    store.dispatch.mockRejectedValueOnce(new Error('boom'));
    await search('x');

    expect(namespaces.value).toEqual([]);
  });

  it('seeds a single namespace and drops the cache', async() => {
    const store = makeStore([ns('a')]);
    const { fetchAll, seed, firstName } = useNamespaces(store);

    await fetchAll();
    seed('picked');
    expect(firstName.value).toBe('picked');

    seed('');
    expect(firstName.value).toBe('');

    await fetchAll();
    const requests = store.dispatch.mock.calls.filter(([action]) => action === 'epinio/request');

    expect(requests).toHaveLength(2);
  });

  it('scopes to the active namespace filter when asked', async() => {
    const store = makeStore([ns('a'), ns('b')], { b: true });
    const { fetchAll, options } = useNamespaces(store, { scopeToActiveFilter: true });

    await fetchAll();

    expect(options.value.map((o) => o.value)).toEqual(['b']);
  });

  it('ignores the active filter by default', async() => {
    const store = makeStore([ns('a'), ns('b')], { b: true });
    const { fetchAll, options } = useNamespaces(store);

    await fetchAll();

    expect(options.value).toHaveLength(2);
  });

  it('shows everything when the active filter is empty', async() => {
    const store = makeStore([ns('a'), ns('b')], {});
    const { fetchAll, options } = useNamespaces(store, { scopeToActiveFilter: true });

    await fetchAll();

    expect(options.value).toHaveLength(2);
  });
});
