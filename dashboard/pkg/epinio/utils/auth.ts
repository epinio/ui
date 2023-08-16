import { User, UserManager } from 'oidc-client-ts';
import { base64Encode } from '@shell/utils/crypto';

export enum EpinioAuthTypes {
  LOCAL,
  DEX,
}

export interface EpinioAuthUser {
  email: string,
  name: string,
}

export interface EpinioAuthConfigBasics {
  type: EpinioAuthTypes,
  epinioUrl: string,
}

export interface EpinioAuthDexConfig {
  dashboardUrl: string,
  dexUrl: string,
}

export type EpinioAuthConfig = EpinioAuthConfigBasics & EpinioAuthDexConfig

/**
 *
 */
class EpinioAuth {
  private dexUserManager?: UserManager;
  private config?: EpinioAuthConfig;

  async isLoggedIn(epinioUrl: string) {
    switch (this.config?.type) {
    case EpinioAuthTypes.DEX:
      if (this.config?.epinioUrl === epinioUrl) {
        const user = await this.user();

        if (user) {
          return true;
        }
      }
      break;
    }

    return false;
  }

  async login(config: EpinioAuthConfig) {
    if (await this.isLoggedIn(config.epinioUrl)) {
      return;
    }

    switch (config.type) {
    case EpinioAuthTypes.DEX:
      if (!this.dexUserManager) {
        this.initialiseDex(config);
      }

      return this.dexUserManager?.signinPopup({
        popupWindowFeatures: { toolbar: 'HELLO THAR' },
        extraQueryParams:    { test: true }
      })
        .then(() => {
          console.debug('Logged in to dex');

          this.config = config;
        });
    default:
      throw new Error(`Epinio Auth type not provided: ${ config.type }`);
    }
  }

  async user(): Promise<EpinioAuthUser | undefined> {
    let dexUser;

    switch (this.config?.type) {
    case EpinioAuthTypes.DEX:
      dexUser = await this.dexUserManager?.getUser();

      if (!dexUser) {
        return;
      }

      return {
        email: dexUser.profile.email || '',
        name:  dexUser.profile.name || ''
      };
    }
  }

  async authHeader() {
    let dexUser: User | null | undefined = null;
    let type: string;

    switch (this.config?.type) {
    case EpinioAuthTypes.DEX:
      dexUser = await this.dexUserManager?.getUser();

      if (!dexUser) {
        return;
      }

      type = dexUser.token_type;

      return `${ dexUser.token_type[0].toUpperCase() + type.slice(1) } ${ dexUser?.access_token }`;
    default:
      // TODO: RC HACK FOR NOW
      return `Basic ${ base64Encode(`admin:password`) }`;
    }
  }

  async logout() {
    switch (this.config?.type) {
    case EpinioAuthTypes.DEX:
      await this.dexUserManager?.revokeTokens(['access_token', 'refresh_token']);
      await this.dexUserManager?.removeUser();
      await this.dexUserManager?.clearStaleState();
      break;
    }

    delete this.config;
  }

  // setLevel

  // private async type(): Promise<EpinioAuthTypes | null> {
  //   if (await this.dexUser()) {
  //     return EpinioAuthTypes.DEX;
  //   }

  //   return null;
  // }

  async dexRedirect(route: { url: string}, config: EpinioAuthDexConfig) {
    if (!this.dexUserManager) {
      await this.initialiseDex(config);
    }
    await this.dexUserManager?.signinPopupCallback(route.url);
  }

  async initialiseDex(config: EpinioAuthDexConfig) {
    if (this.dexUserManager) {
      this.logout();
    }

    const dexUrl = config.dexUrl;

    if (!dexUrl) {
      throw new Error(`Missing dexUrl: ${ config }`);
    }

    this.dexUserManager = new UserManager({
      authority: dexUrl,
      metadata:  {
        issuer:                 dexUrl,
        authorization_endpoint: `${ dexUrl }/auth`,
        userinfo_endpoint:      dexUrl,
        end_session_endpoint:   dexUrl,
        token_endpoint:         `${ dexUrl }/token`,
      },
      client_id:    'rancher-dashboard',
      redirect_uri: `${ config.dashboardUrl }/epinio/auth/verify/`,
      scope:        'openid offline_access profile email groups audience:server:client_id:epinio-api federated:id'
    });
  }
}

const epinioAuth = new EpinioAuth();

export default epinioAuth;
