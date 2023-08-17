import Resource from '@shell/plugins/dashboard-store/resource-class';
import { EPINIO_TYPES } from '../types';
import epinioAuth, { EpinioAuthTypes } from '../utils/auth';

export default class EpinioCluster extends Resource {
  type = EPINIO_TYPES.INSTANCE;

  id: string;
  name: string;
  state: string;
  api: string;
  readyApi: string;
  mgmtCluster?: any

  /**
   *
   */
  constructor(data: {
    id: string,
    name: string,
    state: string,
    api: string,
    readyApi: string,
  }) {
    super(data, null);
    this.id = data.id;
    this.name = data.name;
    this.state = data.state;
    this.api = data.api;
    this.readyApi = data.readyApi;
  }

  get availableActions() {
    // TODO: RC this isn't async! might have to put the log in state in the object
    // const isLoggedIn = await epinioAuth.isLoggedIn({
    //   type:      EpinioAuthTypes.AGNOSTIC,
    //   epinioUrl: c.api,
    //   dexConfig: {
    //     dashboardUrl: window.origin, // 'https://localhost:8005', // TODO: RC get current url
    //     dexUrl:       `https://auth.46.101.17.26.nip.io`, // TODO: RC from config
    //   },
    // });

    // TODO: RC

    return [
      {
        action:   'logOut',
        enabled:  true,
        icon:     'icon icon-fw icon-spinner',
        label:    'Log Out', // this.t('harvester.action.createVM'),
        disabled: false,
      },
    ];
  }

  async logOut() {
    await epinioAuth.logout({
      type:      EpinioAuthTypes.AGNOSTIC,
      epinioUrl: this.api,
      dexConfig: {
        dashboardUrl: window.origin, // 'https://localhost:8005', // TODO: RC get current url
        dexUrl:       `https://auth.46.101.17.26.nip.io`, // TODO: RC from config
      },
    });
  }
}
