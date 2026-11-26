/**
 * Epinio browser auth (EPINIO-837).
 *
 * Same-origin / standalone: login/logout/OIDC use epinio-server session cookies.
 * Cross-origin Rancher extension: keep Basic / Dex Bearer (cookies are unreliable cross-site).
 */

import { User, UserManager } from 'oidc-client-ts';
import { base64Encode } from '@shell/utils/crypto';

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

/** Cross-origin API (Rancher extension) — cookie sessions are unreliable; use Bearer/Basic. */
function isCrossOriginApi(epinioUrl: string): boolean {
  return !!epinioUrl && epinioUrl.replace(/\/$/, '') !== window.location.origin;
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
  private dexUserManager?: UserManager;
  private localUserManager?: {
    epinioUrl: string,
    config: EpinioAuthLocalConfig
  };

  constructor() {
    try {
      this.sessionUser = sessionStorage.getItem(SESSION_USER_KEY) || undefined;
    } catch {
      // ignore
    }
  }

  private isLocal() {
    return !!(this.localUserManager?.config.username && this.localUserManager?.config.password);
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
    // Extension / cross-origin: Basic or Dex bearer in memory / oidc-client.
    if (config && isCrossOriginApi(config.epinioUrl)) {
      if ((config.type === EpinioAuthTypes.LOCAL || config.type === EpinioAuthTypes.AGNOSTIC) && this.isLocal()) {
        return true;
      }

      if (config.type === EpinioAuthTypes.DEX || config.type === EpinioAuthTypes.AGNOSTIC) {
        if (!this.dexUserManager && config.dexConfig) {
          await this.initialiseDex(config.dexConfig);
        }
        const dexUser = await this.dexUserManager?.getUser();

        return !!(dexUser && dexUser.profile.iss === config.dexConfig?.dexUrl);
      }

      return false;
    }

    if (!config?.epinioUrl) {
      return !!this.sessionUser;
    }

    // Same-origin: EPINIO_SESSION is HttpOnly — always confirm via /me.
    const user = await this.fetchMe(config.epinioUrl);

    return !!user;
  }

  async login(config: EpinioAuthConfig): Promise<EpinioAuthUser | undefined> {
    if (await this.isLoggedIn(config)) {
      return this.user();
    }

    const crossOrigin = isCrossOriginApi(config.epinioUrl);

    switch (config.type) {
    case EpinioAuthTypes.DEX: {
      if (crossOrigin) {
        if (!config.dexConfig) {
          throw new Error('dexConfig required');
        }
        if (!this.dexUserManager || this.dexUserManager.settings.authority !== config.dexConfig.dexUrl) {
          await this.initialiseDex(config.dexConfig);
        }

        await this.dexUserManager?.signinPopup();
        delete this.localUserManager;

        return this.user();
      }

      const base = apiBase(config.epinioUrl);

      // Full-page OIDC start on the Epinio server (PKCE + callback set cookies).
      window.location.assign(`${ base }/api/v1/auth/oidc/start`);

      return undefined;
    }
    case EpinioAuthTypes.LOCAL: {
      if (!config.localConfig) {
        throw new Error('localConfig required');
      }

      if (crossOrigin) {
        // Extension: validate with Basic and keep credentials for authHeader().
        try {
          await config.localConfig.$axios({
            url:     `${ config.epinioUrl }/api/v1/me`,
            headers: { Authorization: `Basic ${ base64Encode(`${ config.localConfig.username }:${ config.localConfig.password }`) }` },
          });
        } catch (err: any) {
          if (err?.response?.status === 401) {
            return Promise.reject(new Error('Invalid Credentials'));
          }

          return Promise.reject(err);
        }

        this.localUserManager = {
          epinioUrl: config.epinioUrl,
          config:    config.localConfig,
        };
        this.rememberUser(config.localConfig.username);

        return { email: config.localConfig.username, name: config.localConfig.username };
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
      delete this.localUserManager;

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
    if (this.isLocal()) {
      return {
        email: this.localUserManager?.config.username as string,
        name:  this.localUserManager?.config.username as string,
      };
    }

    if (this.sessionUser) {
      return { email: this.sessionUser, name: this.sessionUser };
    }

    try {
      const dexUser = await this.dexUserManager?.getUser();

      if (!dexUser) {
        return undefined;
      }

      return {
        email: dexUser.profile.email || '',
        name:  dexUser.profile.name || '',
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Same-origin: no Authorization (cookie session).
   * Extension / cross-origin: Basic or Dex Bearer.
   */
  async authHeader(config: EpinioAuthConfig): Promise<string | undefined> {
    if ((config.type === EpinioAuthTypes.LOCAL || config.type === EpinioAuthTypes.AGNOSTIC) && this.isLocal()) {
      return `Basic ${ base64Encode(`${ this.localUserManager?.config.username }:${ this.localUserManager?.config.password }`) }`;
    }

    if (config.type === EpinioAuthTypes.DEX || config.type === EpinioAuthTypes.AGNOSTIC) {
      if (!this.dexUserManager && config.dexConfig) {
        await this.initialiseDex(config.dexConfig);
      }
      const dexUser = await this.dexUserManager?.getUser();

      if (dexUser?.access_token) {
        const type = dexUser.token_type || 'bearer';

        return `${ type[0].toUpperCase() + type.slice(1) } ${ dexUser.access_token }`;
      }
    }

    return undefined;
  }

  async logout(config?: EpinioAuthConfig) {
    if (!config || config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.LOCAL) {
      delete this.localUserManager;
    }

    if (!config || config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.DEX) {
      if (!this.dexUserManager && config?.dexConfig) {
        await this.initialiseDex(config.dexConfig);
      }

      await this.dexUserManager?.removeUser();
      await this.dexUserManager?.clearStaleState();
    }

    const epinioUrl = config?.epinioUrl || '';

    if (epinioUrl && !isCrossOriginApi(epinioUrl)) {
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
    }

    this.forgetUser();
  }

  async dexRedirect(route: { url: string, query: Record<string, any>}, config: EpinioAuthDexConfig) {
    if (!this.dexUserManager) {
      await this.initialiseDex(config);
    }

    await this.dexUserManager?.signinPopupCallback(route.url);
  }

  async initialiseDex(config?: EpinioAuthDexConfig) {
    if (!config) {
      throw new Error('config is required');
    }

    const dexUrl = config.dexUrl;

    if (!dexUrl) {
      throw new Error(`Missing dexUrl: ${ config }`);
    }

    sessionStorage.setItem('epinio-dex-url', dexUrl);

    this.dexUserManager = new UserManager({
      authority: dexUrl,
      metadata:  {
        issuer:                 dexUrl,
        authorization_endpoint: `${ dexUrl }/auth`,
        userinfo_endpoint:      dexUrl,
        end_session_endpoint:   dexUrl,
        token_endpoint:         `${ dexUrl }/token`,
      },
      client_id:     'rancher-dashboard',
      redirect_uri:  `${ config.dashboardUrl }/epinio/auth/verify/`,
      scope:         'openid offline_access profile email groups audience:server:client_id:epinio-api federated:id',
      response_type: 'code',
    });
  }
}

const epinioAuth = new EpinioAuth();

export default epinioAuth;
