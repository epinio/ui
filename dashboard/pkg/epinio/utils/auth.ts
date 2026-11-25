/**
 * Epinio browser auth (EPINIO-837).
 * Login/logout/OIDC go to the Epinio API server session cookies — not Jetstream Dex/Basic.
 */

export enum EpinioAuthTypes {
  LOCAL = 'local',
  DEX = 'dex',
  AGNOSTIC = 'agnostic'
}

export interface EpinioAuthUser {
  email: string,
  name: string,
}

export interface EpinioAuthDexConfig {
  dashboardUrl: string,
  dexUrl: string,
}

export interface EpinioAuthLocalConfig {
  username: string,
  password: string,
  $axios?: any,
}

export interface EpinioAuthConfig {
  type: EpinioAuthTypes,
  epinioUrl: string,
  dexConfig?: EpinioAuthDexConfig,
  localConfig?: EpinioAuthLocalConfig
}

const SESSION_USER_KEY = 'epinio-session-user';

function apiBase(epinioUrl: string): string {
  // Same-origin standalone: empty string so /api hits the ingress → epinio-server.
  if (!epinioUrl || epinioUrl === window.location.origin) {
    return '';
  }

  return epinioUrl.replace(/\/$/, '');
}

function readCookie(name: string): string | undefined {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ name }=`));

  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

/** CSRF for Epinio server mutating calls (EPINIO_CSRF + historical "=" quirk). */
function epinioCsrfHeader(): HeadersInit {
  const csrf = readCookie('EPINIO_CSRF');

  if (!csrf) {
    return {};
  }

  return { 'X-Api-Csrf': `${ csrf }=` };
}

/** CSRF for Jetstream `/pp/...` mutating calls (exact session token, no "="). */
function jetstreamCsrfHeader(): HeadersInit {
  const csrf = readCookie('CSRF') || readCookie('XSRF-TOKEN');

  if (!csrf) {
    return {};
  }

  return { 'X-Xsrf-Token': csrf };
}

class EpinioAuth {
  private sessionUser?: string;

  constructor() {
    try {
      this.sessionUser = sessionStorage.getItem(SESSION_USER_KEY) || undefined;
    } catch {
      // ignore
    }
  }

  private rememberUser(username: string) {
    this.sessionUser = username;
    try {
      sessionStorage.setItem(SESSION_USER_KEY, username);
    } catch {
      // ignore
    }
  }

  private forgetUser() {
    this.sessionUser = undefined;
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore
    }
  }

  private async fetchMe(epinioUrl: string): Promise<EpinioAuthUser | undefined> {
    const res = await fetch(`${ apiBase(epinioUrl) }/api/v1/me`, {
      method:      'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      return undefined;
    }

    const data = await res.json().catch(() => null);
    const username = data?.user;

    if (!username) {
      return undefined;
    }

    this.rememberUser(username);

    return { email: username, name: username };
  }

  async isLoggedIn(config: EpinioAuthConfig) {
    if (!config?.epinioUrl) {
      return !!this.sessionUser;
    }

    if (this.sessionUser && readCookie('EPINIO_SESSION')) {
      return true;
    }

    const user = await this.fetchMe(config.epinioUrl);

    return !!user;
  }

  async login(config: EpinioAuthConfig): Promise<EpinioAuthUser | undefined> {
    if (await this.isLoggedIn(config)) {
      return this.user();
    }

    switch (config.type) {
    case EpinioAuthTypes.DEX: {
      const base = apiBase(config.epinioUrl);

      // Full-page OIDC start on the Epinio server (PKCE + callback set cookies).
      window.location.assign(`${ base }/api/v1/auth/oidc/start`);

      return undefined;
    }
    case EpinioAuthTypes.LOCAL: {
      if (!config.localConfig) {
        throw new Error('localConfig required');
      }

      const base = apiBase(config.epinioUrl);
      const res = await fetch(`${ base }/api/v1/auth/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'content-type': 'application/json' },
        body:        JSON.stringify({
          username: config.localConfig.username,
          password: config.localConfig.password,
        }),
      });

      if (res.status === 401) {
        return Promise.reject(new Error('Invalid Credentials'));
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.errors?.[0]?.title || data?.message || res.statusText;

        return Promise.reject(new Error(message));
      }

      const data = await res.json().catch(() => ({}));
      const username = data?.user || config.localConfig.username;

      this.rememberUser(username);

      // Standalone Shell still needs a Jetstream session for the dashboard chrome.
      await this.syncShellSession();

      return { email: username, name: username };
    }
    default:
      throw new Error(`Epinio Auth type not provided: ${ config.type }`);
    }
  }

  /**
   * After Epinio server cookies exist, ask Jetstream to open a Shell session
   * from /api/v1/me (used by standalone Rancher Shell login chrome).
   */
  async syncShellSession(): Promise<void> {
    try {
      const res = await fetch('/pp/v1/auth/epinio-cookie-login', {
        method:      'POST',
        credentials: 'include',
        headers:     {
          'content-type': 'application/json',
          ...jetstreamCsrfHeader(),
        },
        body: '{}',
      });

      // Endpoint may be absent in extension-only / older Jetstream — ignore.
      if (res.status === 404) {
        return;
      }
    } catch {
      // ignore — extension mode does not need Jetstream
    }
  }

  async user(): Promise<EpinioAuthUser | undefined> {
    if (this.sessionUser) {
      return { email: this.sessionUser, name: this.sessionUser };
    }

    return undefined;
  }

  /**
   * Prefer cookie session: return no Authorization header so the server
   * authenticates via EPINIO_SESSION (+ CSRF on mutating calls).
   */
  async authHeader(_config: EpinioAuthConfig): Promise<string | undefined> {
    return undefined;
  }

  async logout(config?: EpinioAuthConfig) {
    const epinioUrl = config?.epinioUrl || '';

    try {
      await fetch(`${ apiBase(epinioUrl) }/api/v1/auth/logout`, {
        method:      'POST',
        credentials: 'include',
        headers:     {
          'content-type': 'application/json',
          ...epinioCsrfHeader(),
        },
        body: '{}',
      });
    } catch {
      // still clear local state
    }

    this.forgetUser();
  }

  /** @deprecated OIDC callback is handled by the Epinio server. */
  async dexRedirect() {
    // no-op: kept so old verify.vue imports do not break mid-deploy
  }

  /** @deprecated Dex UserManager removed — server owns OIDC. */
  async initialiseDex() {
    // no-op
  }
}

const epinioAuth = new EpinioAuth();

export default epinioAuth;
