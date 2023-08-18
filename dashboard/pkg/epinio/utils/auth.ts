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

class EpinioAuth {
  private dexUserManager?: UserManager;
  private localUserManager?: {
    epinioUrl: string,
    config: EpinioAuthLocalConfig
  };

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

      await this.dexUserManager?.signinPopup();

      delete this.localUserManager;

      return this.user();
    case EpinioAuthTypes.LOCAL:
      if (!config.localConfig) {
        throw new Error('localConfig required');
      }

      // Validate
      try {
        await config.localConfig.$axios({
          url:     `${ config.epinioUrl }/api/v1/info`,
          headers: { Authorization: `Basic ${ base64Encode(`${ config.localConfig?.username }:${ config.localConfig?.password }`) }` }
        });
      } catch (err: any) {
        if ( !err || !err.response ) {
          return Promise.reject(err);
        }

        const res = err.response;

        if (res.status === 401) {
          return Promise.reject(new Error('Invalid Credentials'));
        }

        return Promise.reject(res);
      }

      await this.logout();

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
  }

  async logout(config?: EpinioAuthConfig) {
    if (!config || (config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.LOCAL)) {
      delete this.localUserManager;
    }

    if (!config || (config.type === EpinioAuthTypes.AGNOSTIC || config.type === EpinioAuthTypes.DEX )) {
      if (!this.dexUserManager && config?.dexConfig) {
        await this.initialiseDex(config.dexConfig);
      }

      // await this.dexUserManager?.revokeTokens(['access_token', 'refresh_token']); // Metadata does not contain property revocation_endpoint
      await this.dexUserManager?.removeUser();
      await this.dexUserManager?.clearStaleState();
    }
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
      metadata:  { // Supplying the metadata skips a network request to well-known/openid-configuration
        issuer:                 dexUrl,
        authorization_endpoint: `${ dexUrl }/auth`,
        userinfo_endpoint:      dexUrl,
        end_session_endpoint:   dexUrl,
        token_endpoint:         `${ dexUrl }/token`,
      },
      client_id:     'rancher-dashboard',
      redirect_uri:  `${ config.dashboardUrl }/epinio/auth/verify/`, // Note - must contain trailing forward slash
      scope:         'openid offline_access profile email groups audience:server:client_id:epinio-api federated:id',
      response_type: 'code',
    });
  }
}

const epinioAuth = new EpinioAuth();

export default epinioAuth;
