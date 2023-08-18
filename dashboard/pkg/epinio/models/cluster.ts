import Resource from '@shell/plugins/dashboard-store/resource-class';
import { EPINIO_TYPES } from '../types';
import epinioAuth, { EpinioAuthConfig, EpinioAuthLocalConfig, EpinioAuthTypes } from '../utils/auth';
import Vue from 'vue';

export default class EpinioCluster extends Resource {
  type = EPINIO_TYPES.INSTANCE;

  id: string;
  name: string;
  state?: string;
  metadata?: { state: { transitioning: boolean, error: boolean, message: string }};
  loggedIn: boolean;
  api: string;
  readyApi: string;
  mgmtCluster: any

  /**
   *
   */
  constructor(data: {
    id: string,
    name: string,
    loggedIn: boolean,
    api: string,
    readyApi: string,
    mgmtCluster: any,
  }) {
    super(data, null);
    this.id = data.id;
    this.name = data.name;
    this.api = data.api;
    this.readyApi = data.readyApi;
    this.loggedIn = data.loggedIn;
    this.mgmtCluster = data.mgmtCluster;
  }

  get availableActions() {
    return [
      {
        action:   'logOut',
        enabled:  this.loggedIn,
        icon:     'icon icon-fw icon-spinner', // TODO: RC
        label:    'Log Out', // TODO: RC
        disabled: false,
      },
    ];
  }

  async logOut() {
    try {
      await epinioAuth.logout(this.createAuthConfig(EpinioAuthTypes.AGNOSTIC));

      this.loggedIn = false;
    } catch (err) {
      console.error(`Failed to log out: ${ err }`);// eslint-disable-line no-console

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
        dashboardUrl: window.origin,
        dexUrl:       this.api.replace('epinio', 'auth')
      },
      localConfig
    };

    return config;
  }
}
