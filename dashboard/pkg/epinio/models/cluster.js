import NormanCluster from '@shell/models/cluster';
import { EPINIO_TYPES } from '../types';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';
import { dashboardUrl } from '../utils/embedded-helpers';

export const EpinioInfoPath = `/api/v1/info`;

export default class EpinioCluster extends NormanCluster {
  constructor(data, ctx) {
    super(data, ctx);
    this.type = EPINIO_TYPES.CLUSTER;
    this.id = data.id;
    this.name = data.name;
    this.namespace = data.namespace;
    this.api = data.api;
    this.loggedIn = data.loggedIn;
    this.mgmtCluster = data.mgmtCluster;
    this.state = undefined;
    this.metadata = undefined;
    this.version = undefined;
    this.oidcEnabled = false;
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

  createAuthConfig(type, localConfig) {
    const config = {
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
