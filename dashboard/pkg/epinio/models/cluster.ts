import Resource from '@shell/plugins/dashboard-store/resource-class';
import { EPINIO_TYPES } from '../types';
import epinioAuth, { EpinioAuthConfig, EpinioAuthLocalConfig, EpinioAuthTypes } from '../utils/auth';
import { dashboardUrl } from '../utils/embedded-helpers';
import { NAME as APP } from '@shell/config/product/apps';
import { CATALOG } from '@shell/config/types';
import Vue from 'vue';

export const EpinioInfoPath = `/api/v1/info`;

const defaultEpinioChart = {
  repo: 'rancher-charts',
  name: 'epinio',
};

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
  oidcEnabled: boolean = false;
  installed: boolean = false;
  canInstall: boolean = false;
  canUninstall: boolean = false;

  constructor(data: {
    id: string,
    name: string,
    namespace: string,
    loggedIn: boolean,
    api: string,
    mgmtCluster: any,
    installed: boolean,
  }, ctx: any) {
    super(data, ctx);
    this.id = data.id;
    this.name = data.name;
    this.namespace = data.namespace;
    this.api = data.api;
    this.loggedIn = data.loggedIn;
    this.mgmtCluster = data.mgmtCluster;
    this.installed = data.installed;

    if (this.installed) {
      // Can they uninstall?
      // Try to find the installed helm app and check permissions on it

      debugger;
      const url = `/k8s/clusters/${ data.mgmtCluster.id }/v1/catalog.cattle.io.apps/${ data.namespace }/${ defaultEpinioChart.name }?exclude=metadata.managedFields`;

      ctx.$dispatch(`cluster/request`, { url }, { root: true })
        .then((app: any) => {
          Vue.set(this, 'canUninstall', !!app?.actions?.uninstall);
        })
        .catch(() => {
          Vue.set(this, 'canUninstall', false);
        });
    } else {
      // Can they install?

      // Can they install charts in target repo
      const url = `/k8s/clusters/${ data.mgmtCluster.id }/v1/catalog.cattle.io.clusterrepos/${ defaultEpinioChart.repo }?exclude=metadata.managedFields`;

      ctx.$dispatch(`cluster/request`, { url }, { root: true })
        .then((repo: any) => {
          Vue.set(this, 'canInstall', !!repo?.actions?.install);
        })
        .catch(() => {
          Vue.set(this, 'canInstall', false);
        });

      // Ideally we would also check if they can see the target chart to install, but lets go on the assumption epinio app will always be there
    }
  }

  get availableActions() {
    const actions: any[] = [];

    if (this.loggedIn) {
      actions.push({
        action:   'logOut',
        icon:     'icon icon-fw icon-chevron-right',
        label:    this.t('nav.userMenu.logOut'),
        disabled: false,
      });

      actions.push({ divider: true });
    }

    if (this.installed) {
      if (this.canUninstall) {
        actions.push({
          action: 'uninstall',
          icon:   'icon icon-fw icon-minus',
          label:  this.t('asyncButton.uninstall.action'),
        });
      }
    } else {
      if (this.canInstall) {
        actions.push({
          action:   'install',
          icon:     'icon icon-fw icon-plus',
          label:    this.t('asyncButton.install.action'),
          disabled: !this.canInstall,
        });
      }
    }

    return actions;
  }

  get infoUrl() {
    return this.api + EpinioInfoPath;
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
        dashboardUrl: dashboardUrl(),
        dexUrl:       this.api.replace('epinio', 'auth')
      },
      localConfig
    };

    return config;
  }

  install() {
    // Take them to the default helm chart's detail page
    this.currentRouter().push({
      name:   `c-cluster-apps-charts-chart`,
      params: {
        product: APP,
        cluster: this.mgmtCluster.id,
      },
      query: {
        'repo-type': 'cluster',
        repo:        defaultEpinioChart.repo,
        chart:       defaultEpinioChart.name,
      }
    });
  }

  uninstall() {
    // Uninstall is an action from the apps list, so do our best to get the user there
    this.currentRouter().push({
      name:   `c-cluster-product-resource`,
      params: {
        product:  APP,
        cluster:  this.mgmtCluster.id,
        resource: CATALOG.APP,
      },
      query: { q: defaultEpinioChart.name }
    });
  }
}
