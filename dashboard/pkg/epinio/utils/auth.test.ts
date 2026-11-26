jest.mock('@shell/utils/crypto', () => ({
  base64Encode: (value: string) => Buffer.from(value, 'utf8').toString('base64'),
}));

jest.mock('oidc-client-ts', () => ({
  UserManager: jest.fn().mockImplementation(() => ({
    getUser:         jest.fn().mockResolvedValue(null),
    signinPopup:     jest.fn().mockResolvedValue(undefined),
    removeUser:      jest.fn().mockResolvedValue(undefined),
    clearStaleState: jest.fn().mockResolvedValue(undefined),
    settings:        { authority: '' },
  })),
  User: jest.fn(),
}));

import epinioAuth, { EpinioAuthTypes } from './auth';

function mockFetchSequence(responses: Array<Partial<Response> & { json?: () => Promise<any> }>) {
  const fn = jest.fn();

  responses.forEach((r) => {
    fn.mockResolvedValueOnce({
      ok:     r.ok ?? true,
      status: r.status ?? 200,
      json:   r.json ?? (async() => ({})),
      ...r,
    });
  });

  global.fetch = fn as any;

  return fn;
}

describe('epinioAuth (EPINIO-837 server session)', () => {
  const originalLocation = window.location;
  let assignMock: jest.Mock;

  beforeEach(async() => {
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();

      if (name) {
        document.cookie = `${ name }=; Max-Age=0; path=/`;
      }
    });

    assignMock = jest.fn();
    // @ts-ignore — stub location.assign for OIDC start
    delete (window as any).location;
    // Same-origin with epinio API → cookie session path
    (window as any).location = { ...originalLocation, origin: 'https://epinio.example', assign: assignMock };

    mockFetchSequence([{ ok: true, status: 200 }]);
    await epinioAuth.logout({ type: EpinioAuthTypes.AGNOSTIC, epinioUrl: 'https://epinio.example' });
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('login LOCAL posts to /api/v1/auth/login with credentials', async() => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 401 }, // isLoggedIn → /me
      { ok: true, status: 200, json: async() => ({ user: 'admin' }) }, // login
      { ok: true, status: 200 }, // syncShellSession (may 404)
    ]);

    const user = await epinioAuth.login({
      type:        EpinioAuthTypes.LOCAL,
      epinioUrl:   'https://epinio.example',
      localConfig: { username: 'admin', password: 'password' },
    });

    expect(user).toEqual({ email: 'admin', name: 'admin' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method:      'POST',
        credentials: 'include',
        body:        JSON.stringify({ username: 'admin', password: 'password' }),
      })
    );
  });

  it('login LOCAL rejects invalid credentials', async() => {
    mockFetchSequence([
      { ok: false, status: 401 },
      { ok: false, status: 401 },
    ]);

    await expect(epinioAuth.login({
      type:        EpinioAuthTypes.LOCAL,
      epinioUrl:   'https://epinio.example',
      localConfig: { username: 'admin', password: 'bad' },
    })).rejects.toThrow('Invalid Credentials');
  });

  it('login DEX redirects to /api/v1/auth/oidc/start', async() => {
    mockFetchSequence([{ ok: false, status: 401 }]);

    await epinioAuth.login({
      type:      EpinioAuthTypes.DEX,
      epinioUrl: 'https://epinio.example',
      dexConfig: { dashboardUrl: 'https://ui', dexUrl: 'https://auth' },
    });

    expect(assignMock).toHaveBeenCalledWith('/api/v1/auth/oidc/start');
  });

  it('isLoggedIn is true when /api/v1/me succeeds', async() => {
    mockFetchSequence([
      { ok: true, status: 200, json: async() => ({ user: 'admin' }) },
    ]);

    const loggedIn = await epinioAuth.isLoggedIn({
      type:      EpinioAuthTypes.AGNOSTIC,
      epinioUrl: 'https://epinio.example',
    });

    expect(loggedIn).toBe(true);
    expect(await epinioAuth.user()).toEqual({ email: 'admin', name: 'admin' });
  });

  it('logout posts to /api/v1/auth/logout and clears remembered user', async() => {
    mockFetchSequence([
      { ok: true, status: 200, json: async() => ({ user: 'admin' }) },
      { ok: true, status: 200 },
    ]);

    await epinioAuth.isLoggedIn({ type: EpinioAuthTypes.AGNOSTIC, epinioUrl: 'https://epinio.example' });

    const fetchMock = mockFetchSequence([{ ok: true, status: 200 }]);

    await epinioAuth.logout({ type: EpinioAuthTypes.AGNOSTIC, epinioUrl: 'https://epinio.example' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(await epinioAuth.user()).toBeUndefined();
  });

  it('authHeader returns undefined for same-origin cookie session', async() => {
    const header = await epinioAuth.authHeader({
      type:      EpinioAuthTypes.AGNOSTIC,
      epinioUrl: 'https://epinio.example',
    });

    expect(header).toBeUndefined();
  });

  it('cross-origin LOCAL login uses Basic authHeader', async() => {
    (window as any).location = { ...window.location, origin: 'https://rancher.example', assign: assignMock };

    const axiosMock = jest.fn().mockResolvedValue({ status: 200 });

    const user = await epinioAuth.login({
      type:        EpinioAuthTypes.LOCAL,
      epinioUrl:   'https://epinio.example',
      localConfig: { username: 'admin', password: 'password', $axios: axiosMock },
    });

    expect(user).toEqual({ email: 'admin', name: 'admin' });
    expect(axiosMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://epinio.example/api/v1/me',
    }));

    const header = await epinioAuth.authHeader({
      type:      EpinioAuthTypes.AGNOSTIC,
      epinioUrl: 'https://epinio.example',
    });

    expect(header).toMatch(/^Basic /);
  });
});
