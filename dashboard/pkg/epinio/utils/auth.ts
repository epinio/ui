import { User, UserManager } from 'oidc-client-ts';
import { base64Encode, base64Decode } from '@shell/utils/crypto';
import { randomStr } from '@shell/utils/string';

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
}

export interface EpinioAuthConfig {
  type: EpinioAuthTypes,
  epinioUrl: string,
  dexConfig?: EpinioAuthDexConfig,
  localConfig?: EpinioAuthLocalConfig
}

/**
 *
 */
class EpinioAuth {
  private dexUserManager?: UserManager;
  private localUserManager?: {
    epinioUrl: string,
    config: EpinioAuthLocalConfig
  };
  // private config?: EpinioAuthConfig;

  private isLocal() {
    return this.localUserManager?.config.username && this.localUserManager?.config.password;
  }

  async isLoggedIn(config: EpinioAuthConfig) {
    if (!config || (config.type === EpinioAuthTypes.LOCAL || config.type === EpinioAuthTypes.AGNOSTIC)) {
      if (this.isLocal()) {
        return;
      }
    }

    if (!config || (config.type === EpinioAuthTypes.DEX || config.type === EpinioAuthTypes.AGNOSTIC)) {
      if (!this.dexUserManager && config?.dexConfig) {
        await this.initialiseDex(config.dexConfig);
      }
      const dexUser = await this.dexUserManager?.getUser();

      return dexUser && dexUser?.profile.iss === config?.dexConfig?.dexUrl;
    }

    return false;
  }

  async login(config: EpinioAuthConfig): Promise<EpinioAuthUser | undefined> {
    if (await this.isLoggedIn(config)) {
      return;
    }

    switch (config.type) {
    case EpinioAuthTypes.DEX:
      if (!config.dexConfig) {
        throw new Error('dexConfig required');
      }
      if (!this.dexUserManager) {
        this.initialiseDex(config.dexConfig);
      }

      // TODO: RC auto refresh token on expirer? silent refresh?

      await this.dexUserManager?.signinPopup();

      delete this.localUserManager;

      return this.user();
    case EpinioAuthTypes.LOCAL:
      if (!config.localConfig) {
        throw new Error('localConfig required');
      }
      await this.logout();

      // TODO: RC validate
      this.localUserManager = {
        epinioUrl: config.epinioUrl,
        config:    config.localConfig
      };

      return this.user();
    default:
      throw new Error(`Epinio Auth type not provided: ${ config.type }`);
    }
  }

  async user(): Promise<EpinioAuthUser | undefined> {
    if (this.isLocal()) {
      return {
        email: this.localUserManager?.config.username as string,
        name:  this.localUserManager?.config.username as string,
      };
    }

    try {
      const dexUser = await this.dexUserManager?.getUser();

      if (!dexUser) {
        return;
      }

      return {
        email: dexUser.profile.email || '',
        name:  dexUser.profile.name || ''
      };
    } catch {}
  }

  async authHeader(config: EpinioAuthConfig) {
    let dexUser: User | null | undefined = null;
    let type: string;

    if ((config.type === EpinioAuthTypes.LOCAL || config.type === EpinioAuthTypes.AGNOSTIC) && this.isLocal()) {
      return `Basic ${ base64Encode(`${ this.localUserManager?.config.username }:${ this.localUserManager?.config.password }`) }`;
    }

    if ((config.type === EpinioAuthTypes.DEX || config.type === EpinioAuthTypes.AGNOSTIC)) {
      // Attempt dex
      if (!this.dexUserManager && config.dexConfig) {
        this.initialiseDex(config.dexConfig);
      }
      dexUser = await this.dexUserManager?.getUser();

      if (dexUser) {
        type = dexUser.token_type;

        return `${ dexUser.token_type[0].toUpperCase() + type.slice(1) } ${ dexUser?.access_token }`;
      }
    }

    debugger;

    if (config.type === EpinioAuthTypes.AGNOSTIC) {
      // TODO: RC HACK FOR NOW
      return `Basic ${ base64Encode(`admin:password`) }`;
    }
  }

  async logout(config?: EpinioAuthConfig) {
    if (!config || (config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.LOCAL)) {
      delete this.localUserManager;
    }

    if (!config || (config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.DEX )) {
      if (!this.dexUserManager && config?.dexConfig) {
        await this.initialiseDex(config.dexConfig);
      }

      await this.dexUserManager?.revokeTokens(['access_token', 'refresh_token']);
      await this.dexUserManager?.removeUser();
      await this.dexUserManager?.clearStaleState();
    }
  }

  // TODO: RC determine if dex is installed

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
    if (this.dexUserManager) {
      this.logout();
    }

    const dexUrl = config.dexUrl;

    if (!dexUrl) {
      throw new Error(`Missing dexUrl: ${ config }`);
    }

    // Note - if you be thinking extraTokenParams, extraQueryParams, scope are used here, you be wrong

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
      redirect_uri:  `${ config.dashboardUrl }/epinio/auth/verify/`, // Note - must contain trailing forward slash
      scope:         'openid offline_access profile email groups audience:server:client_id:epinio-api federated:id',
      // automaticSilentRenew: true,
      //   silent_redirect_uri: `${window.location.origin}/assets/silent-callback.html`
      response_type: 'code',
    });
    // this.dexUserManager.events.addSilentRenewError // TODO: RC
    // this.manager.events.addAccessTokenExpiring(() => { console.log('token expiring'); this.manager.signinSilent({ extraTokenParams: { appId: 123, domain: 'abc.com' } }).then(user => { }).catch(e => { }); });
  }
}

const epinioAuth = new EpinioAuth();

export default epinioAuth;
