import Resource from '@shell/plugins/dashboard-store/resource-class';
import { EPINIO_TYPES } from '../types';
import epinioAuth, { EpinioAuthConfig, EpinioAuthLocalConfig, EpinioAuthTypes } from '../utils/auth';
import { dashboardUrl } from '../utils/embedded-helpers';

export const EpinioInfoPath = `/api/v1/info`;

export default class EpinioCluster extends Resource {
  type = EPINIO_TYPES.CLUSTER;

  id: string;
  name: string;
  namespace: string;
  state?: string;
  metadata?: { state: { transitioning: boolean, error: boolean, message: string }};
  loggedIn: boolean;
  api: string;
  mgmtCluster: any;
  version?: string;
  oidcEnabled: boolean = false;

  constructor(data: {
    id: string,
    name: string,
    namespace: string,
    loggedIn: boolean,
    api: string,
    mgmtCluster: any,
  }, ctx: any) {
    super(data, ctx);
    this.id = data.id;
    this.name = data.name;
    this.namespace = data.namespace;
    this.api = data.api;
    this.loggedIn = data.loggedIn;
    this.mgmtCluster = data.mgmtCluster;
  }

  get availableActions() {
    return [
      {
        action:   'logOut',
        enabled:  this.loggedIn,
        icon:     'icon icon-fw icon-chevron-right',
        label:    this.t('nav.userMenu.logOut'),
        disabled: false,
      },
    ];
  }

  get infoUrl() {
    return this.api + EpinioInfoPath;
  }

  async logOut() {
    try {
      await epinioAuth.logout(this.createAuthConfig(EpinioAuthTypes.AGNOSTIC));

      this.loggedIn = false;
    } catch (err) {
      console.error(`Failed to log out: ${ err }`);

      this.metadata = {
        state: {
          transitioning: false,
          error:         true,
          message:       'Failed to log out'
        }
      };
    }
  }

  createAuthConfig(type: EpinioAuthTypes, localConfig?: EpinioAuthLocalConfig): EpinioAuthConfig {
    const config: EpinioAuthConfig = {
      type,
      epinioUrl: this.api,
      dexConfig: {
        dashboardUrl: dashboardUrl(),
        dexUrl:       this.api.replace('epinio', 'auth')
      },
      localConfig
    };

    return config;
  }
}
