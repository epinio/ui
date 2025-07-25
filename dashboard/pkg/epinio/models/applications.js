import { classify } from '@shell/plugins/dashboard-store/classify';
import { downloadFile } from '@shell/utils/download';
import { formatSi } from '@shell/utils/units';
import { identity, pickBy } from 'lodash';
import { epiniofy } from '../store/epinio-store/actions';
import {
  APPLICATION_ACTION_STATE, APPLICATION_SOURCE_TYPE, APPLICATION_PARTS, EPINIO_PRODUCT_NAME, EPINIO_TYPES
} from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import EpinioNamespacedResource, { bulkRemove } from './epinio-namespaced-resource';
import { AppUtils } from '../utils/application';
import { WORKLOAD_TYPES } from '@shell/config/types';
import { NAME as EXPLORER } from '@shell/config/product/explorer';
// See https://github.com/epinio/epinio/blob/00684bc36780a37ab90091498e5c700337015a96/pkg/api/core/v1/models/app.go#L11
const STATES = {
  CREATING: 'created',
  STAGING:  'staging',
  RUNNING:  'running',
  ERROR:    'error',
};

// These map to @shell/plugins/dashboard-store/resource-class STATES
const STATES_MAPPED = {
  [STATES.CREATING]: 'created',
  [STATES.STAGING]:  'building',
  [STATES.RUNNING]:  'running',
  [STATES.ERROR]:    'error',
  unknown:           'unknown',
};

function isGitRepo(type) {
  return type === APPLICATION_SOURCE_TYPE.GIT_HUB || type === APPLICATION_SOURCE_TYPE.GIT_LAB;
}

export default class EpinioApplicationModel extends EpinioNamespacedResource {
  constructor(...args) {

    super(...args);

    // Props ---------------------------------------------------
    this.buildCache = {};
  }

  // ------------------------------------------------------------------
  // Dashboard plumbing

  get details() {
    const res = [];

    if (this.state === !!this.deployment) {
      res.push({
        label:   'Last Deployed By',
        content: this.deployment.username,
      });
    }

    return res;
  }

  get state() {
    return STATES_MAPPED[this.status] || STATES_MAPPED.unknown;
  }

  get stateObj() {
    switch (this.status) {
    case STATES.CREATING:
      return {
        error:         false,
        transitioning: false,
        message:       this.statusmessage
      };
    case STATES.STAGING:
      return {
        error:         false,
        transitioning: true,
        message:       this.statusmessage
      };
    case STATES.RUNNING:
      return {
        error:         false,
        transitioning: false,
        message:       this.statusmessage
      };
    case STATES.ERROR:
      return {
        error:         true,
        transitioning: false,
        message:       this.statusmessage
      };
    default:
      return {
        error:         true,
        transitioning: false,
        message:       this.statusmessage
      };
    }
  }

  get _availableActions() {
    const res = [];

    const isRunning = [STATES.RUNNING].includes(this.status);
    const showAppLog = isRunning;
    const showStagingLog = !!this.stage_id;
    const showAppShell = isRunning;

    if (showAppShell) {
      res.push({
        action:  'showAppShell',
        label:   this.t('epinio.applications.actions.shell.label'),
        icon:    'icon icon-fw icon-terminal',
        enabled: showAppShell,
      });
    }
    res.push(
      {
        action:  'showAppLog',
        label:   this.t('epinio.applications.actions.viewAppLogs.label'),
        icon:    'icon icon-fw icon-file',
        enabled: showAppLog,
      },
      {
        action:  'showStagingLog',
        label:   this.t('epinio.applications.actions.viewStagingLogs.label'),
        icon:    'icon icon-fw icon-file',
        enabled: showStagingLog,
      },
    );

    res.push( {
      action:  'restage',
      label:   this.t('epinio.applications.actions.restage.label'),
      icon:    'icon icon-fw icon-backup',
      enabled: !!this.deployment?.stage_id
    },
    {
      action:  'restart',
      label:   this.t('epinio.applications.actions.restart.label'),
      icon:    'icon icon-fw icon-refresh',
      enabled: isRunning
    },
    {
      action:  'exportApp',
      label:   this.t('epinio.applications.export.label'),
      icon:    'icon icon-fw icon-download',
      enabled: isRunning
    },
    { divider: true },
    );

    if (this.canViewDeployment) {
      res.push({
        action: 'viewDeployment',
        label:  this.t('epinio.applications.actions.viewDeployment.label'),
        icon:   'icon icon-fw icon-chevron-right',
      },
      { divider: true },
      );
    }

    res.push(
      ...super._availableActions
    );

    return res;
  }

  get links() {
    return {
      update:        this.getUrl(),
      self:          this.getUrl(),
      remove:        this.getUrl(),
      create:        this.getUrl(this.meta?.namespace, null), // ensure name is null
      store:         `${ this.getUrl() }/store`,
      stage:         `${ this.getUrl() }/stage`,
      deploy:        `${ this.getUrl() }/deploy`,
      configBinding: `${ this.getUrl() }/configurationbindings`,
      logs:          `${ this.getUrl() }/logs`.replace('/api/v1', '/wapi/v1'), // /namespaces/:namespace/applications/:app/logs
      importGit:     `${ this.getUrl() }/import-git`,
      restart:       `${ this.getUrl() }/restart`,
      shell:         `${ this.getUrl() }/exec`.replace('/api/v1', '/wapi/v1'), // /namespaces/:namespace/applications/:app/exec
    };
  }

  // ------------------------------------------------------------------
  // Getters

  getUrl(namespace = this.meta?.namespace, name = this.meta?.name) {
    // Add baseUrl in a generic way
    return this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/namespaces/${ namespace }/applications/${ name || '' }` });
  }

  get services() {
    return this.$getters['all'](EPINIO_TYPES.SERVICE_INSTANCE)
      .filter((s) => {
        return s.metadata.namespace === this.metadata.namespace &&
          s.boundapps?.includes(this.metadata.name);
      });
  }

  get allConfigurations() {
    return this.$getters['all'](EPINIO_TYPES.CONFIGURATION)
      .filter((s) => {
        return s.metadata.namespace === this.metadata.namespace &&
         this.configuration.configurations.find((c) => c === s.metadata.name);
      });
  }

  get allConfigurationsNames() {
    return this.allConfigurations.map((c) => c.meta.name);
  }

  get baseConfigurations() {
    return this.allConfigurations.filter((c) => !c.isServiceRelated);
  }

  get baseConfigurationsNames() {
    return this.baseConfigurations.map((c) => c.meta.name);
  }

  get serviceConfigurations() {
    return this.allConfigurations.filter((c) => c.isServiceRelated);
  }

  get serviceConfigurationsNames() {
    return this.serviceConfigurations.map((c) => c.meta.name);
  }

  get envCount() {
    return Object.keys(this.configuration?.environment || []).length;
  }

  get routeCount() {
    return this.configuration?.routes.length;
  }

  get memory() {
    return formatSi(this.deployment?.memoryBytes);
  }

  get desiredInstances() {
    return this.deployment?.desiredreplicas;
  }

  set desiredInstances(neu) {
    this.deployment.desiredreplicas = neu;
  }

  get readyInstances() {
    return this.deployment?.readyreplicas;
  }

  get cpu() {
    return this.deployment?.millicpus;
  }

  get appData() {
    const type = AppUtils.getSourceType(this.origin);

    const opt = {};

    switch (type) {
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
      opt.archive = { fileName: this.origin.path };
      break;
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      opt.container_url = { url: this.origin.container };
      break;
    case APPLICATION_SOURCE_TYPE.FOLDER:
      opt.folder = { fileName: this.origin.path };
      break;
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      opt.git_url = {
        branch: this.origin.git?.revision || '',
        url:    this.origin.git?.repository || ''
      };
      break;
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      opt[type] = AppUtils.getGitData(this.origin.git);
      break;
    default:
      break;
    }

    return {
      source: {
        ...opt,
        type,
        builderImage: this.staging.builder,
        appchart:     this.configuration.appchart,
      },
    };
  }

  get appSource() {
    const { source } = this.appData;

    return {
      type:      source.type,
      appChart:  source.appchart,
      git:       isGitRepo(source.type) ? source[source.type] : null,
      gitUrl:    source.git_url,
      container: source.container_url,
      archive:   source.archive
    };
  }

  get appSourceInfo() {
    const { source } = this.appData;

    const appChart = {
      label: 'App Chart',
      value: source.appchart
    };
    const builderImage = {
      label: 'Builder Image',
      value: source.builderImage
    };

    switch (source.type) {
    case APPLICATION_SOURCE_TYPE.FOLDER:
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
      return {
        label:   'File system',
        icon:    'icon-file',
        details: [
          {
            label: 'Original Name',
            value: source.archive?.fileName
          }, appChart, builderImage
        ]
      };
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      return {
        label:   'Git',
        icon:    'icon-file',
        details: [
          {
            label: 'Url',
            value: source.git_url?.url
          }, {
            label: 'Revision',
            icon:  'icon-commit',
            value: source.git_url?.branch
          }, appChart, builderImage
        ]
      };
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      return {
        label:   this.t(`epinio.applications.gitSource.${ source.type }.label`),
        icon:    `icon-${ source.type }`,
        details: [
          {
            label: 'Url',
            value: source[source.type]?.url
          }, {
            label: 'Revision',
            icon:  'icon-commit',
            value: source[source.type]?.commit
          }, {
            label: 'Branch',
            icon:  'icon-commit',
            value: source[source.type]?.branch.name
          }, appChart, builderImage
        ]
      };
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      return {
        label:   'Container',
        icon:    'icon-docker',
        details: [{
          label: 'Image',
          value: source.container_url?.url
        }, appChart
        ]
      };
    default:
      return undefined;
    }
  }

  get instances() {
    const instances = this.deployment?.replicas;

    if (!instances) {
      return [];
    }

    return Object.values(instances).map((i) => classify(this.$ctx, {
      ...i,
      id:          i.name,
      type:        EPINIO_TYPES.APP_INSTANCE,
      application: this
    }));
  }

  get instanceMemory() {
    const stats = this._instanceStats('memoryBytes');
    const opts = {
      suffix:      'iB',
      firstSuffix: 'B',
      increment:   1024,
    };

    stats.min = formatSi(stats.min, opts);
    stats.max = formatSi(stats.max, opts);
    stats.avg = formatSi(stats.avg, opts);

    return stats;
  }

  get instanceCpu() {
    return this._instanceStats('millicpus');
  }

  _instanceStats(prop) {
    const stats = this.instances.reduce((res, r) => {
      if (r[prop] >= res.max) {
        res.max = r[prop];
      }
      if (r[prop] <= res.min) {
        res.min = r[prop];
      }
      res.total += r[prop];

      return res;
    }, {
      min: this.instances[0]?.[prop] || 0, max: 0, total: 0
    });

    const avg = this.instances.length ? (stats.total / this.instances.length).toFixed(2) : 0;

    return {
      ...stats,
      avg: avg === '0.00' ? 0 : avg,
    };
  }

  /**
   * Convenience, null safe accessor for routes
   */
  get routes() {
    return this.configuration?.routes || [];
  }

  get doneLocationRemove() {
    return createEpinioRoute(`c-cluster-applications`, {}) ;
  }

  get applicationParts() {
    return Object.values(APPLICATION_PARTS);
  }

  // TODO: Remove after merging with master
  get applyMode() {
    return 'export';
  }

  get canViewDeployment() {
    return !this.$rootGetters['isSingleProduct'] && !!this.$getters[`schemaFor`](WORKLOAD_TYPES.DEPLOYMENT);
  }

  /**
   * Attempt to view the deployment for this namespace in Rancher's UI
   *
   * If we can't find the deployment, just go to the deployment list with the name in the filter
   */
  viewDeployment() {
    const clusterId = this.$rootGetters['clusterId'];
    const namespace = this.metadata.namespace;
    const appName = this.metadata.name;
    const url = `/k8s/clusters/${ clusterId }/v1/apps.deployments/${ namespace }?labelSelector=app.kubernetes.io/component%3Dapplication,app.kubernetes.io/name%3D${ appName }`;

    const deploymentList = {
      name:   `c-cluster-product-resource`,
      params: {
        product:  EXPLORER,
        cluster:  clusterId,
        resource: WORKLOAD_TYPES.DEPLOYMENT,
      },
      query: { q: this.metadata.name }
    };

    this.$dispatch(`cluster/request`, { url }, { root: true })
      .then((deployments) => {
        if (deployments?.data?.length === 1) {
          const deployment = deployments.data[0];

          this.currentRouter().push({
            name:   `c-cluster-product-resource-namespace-id`,
            params: {
              ...deploymentList.params,
              namespace: deployment.metadata.namespace,
              id:        deployment.metadata.name,
            }
          });
        } else {
          this.currentRouter().push(deploymentList);
        }
      }).catch(() => {
        this.currentRouter().push(deploymentList);
      });
  }

  // ------------------------------------------------------------------
  // Change/handle changes of the app

  trace(text, ...args) {
    console.log(
      `### Application: ${ text }`, 
      `${ this.meta.namespace }/${ this.meta.name }`, 
      args.length ? args : ''
    );
  }

  async create() {
    this.trace('Create the application resource');
    const { type, id } = epiniofy(this, this.schema, this.type);

    this.type = type;
    this.id = id;

    await this.followLink('create', {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: {
        name:          this.meta.name,
        configuration: {
          appchart:       this.configuration.appchart,
          settings:       pickBy(this.configuration?.settings, identity) || null,
          instances:      this.configuration.instances,
          configurations: this.configuration.configurations,
          environment:    this.configuration.environment,
          routes:         this.configuration.routes.length ? this.configuration.routes : null,
        }
      }
    });
  }

  async gitFetch(url, rev) {
    this.trace('Downloading and storing git repo');
    const formData = new FormData();

    formData.append('giturl', url);
    formData.append('gitrev', rev );

    const res = await this.followLink('importGit', {
      method:  'post',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept:         'gzip'
      },
      data: formData
    });

    this.buildCache.store = { blobUid: res.blobuid };

    return res.blobuid;
  }

  async update(options) {
    this.trace('Update the application resource');
    await this.followLink('update', {
      method:  'patch',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
      data: {
        restart:        options?.restart ?? true,
        appchart:       this.configuration.appchart,
        instances:      this.configuration.instances,
        configurations: this.configuration.configurations,
        settings:       pickBy(this.configuration?.settings, identity) || null,
        environment:    this.configuration.environment,
        routes:         this.configuration.routes,
      }
    });
  }

  async storeArchive(data) {
    this.trace('Storing Application archive');

    const formData = new FormData();

    formData.append('file', data);

    const res = await this.followLink('store', {
      method:  'post',
      headers: {
        'content-type': 'multipart/form-data',
        'File-Size':    data.size,
      },
      data: formData
    });

    this.buildCache.store = { blobUid: res.blobuid };

    return res.blobuid;
  }

  async stage(blobuid, builderImage) {
    this.trace('Staging Application bits');

    const { image, stage } = await this.followLink('stage', {
      method:  'post',
      headers: { 'content-type': 'application/json' },
      data:    {
        app: {
          name:      this.meta.name,
          namespace: this.meta.namespace
        },
        blobuid,
        builderimage: builderImage
      }
    });

    this.buildCache = this.buildCache || {};

    this.buildCache.stage = {
      stage,
      image
    };

    return { image, stage };
  }

  async restage() {
    const { stage } = await this.stage();

    await this.forceFetch();
    this.showStagingLog(stage.id);
  }

  async exportApp(resources = this) {
    this.$dispatch(
      'cluster/promptModal', {
        component: 'ExportAppDialog',
        resources,
      },
      { root: true },
    );
  }

  async fetchPart(part, options = {}) {
    const responseType = part === 'values' || part === 'manifest' ? 'text/plain' : 'blob';

    const opt = {
      ...options,
      url: `${ this.linkFor('self') }/part/${ part }`,
      responseType
    };

    const { data } = await this.$dispatch('request', { opt, type: this.type });

    return data;
  }

  async downloadAppParts({ part, data }) {
    if (part === 'values') {
      await downloadFile(`${ this.meta.name }-${ part }.yaml`, data, 'text/plain');
    } else {
      await downloadFile(`${ this.meta.name }-${ part }`, data, 'application/gzip;charset=utf-8');
    }
  }

  get appShellId() {
    return `epinio-${ this.id }-app-shell`;
  }

  get appLogId() {
    return `epinio-${ this.id }-app-logs`;
  }

  get stagingLog() {
    return `epinio-${ this.id }-logs-`;
  }

  showAppShell() {
    this.$dispatch('wm/open', {
      id:        this.appShellId,
      label:     `${ this.meta.name } - App Shell`,
      product:   EPINIO_PRODUCT_NAME,
      icon:      'chevron-right',
      component: 'ApplicationShell',
      attrs:     {
        application:     this,
        endpoint:        this.linkFor('shell'),
        initialInstance: this.instances[0].id
      }
    }, { root: true });
  }

  showAppLog() {
    this.$dispatch('wm/open', {
      id:        this.appLogId,
      label:     `${ this.meta.name } - App Logs`,
      product:   EPINIO_PRODUCT_NAME,
      icon:      'file',
      component: 'ApplicationLogs',
      attrs:     {
        application: this,
        endpoint:    this.linkFor('logs')
      }
    }, { root: true });
  }

  showStagingLog(stageId = this.stage_id) {
    if (!stageId) {
      console.warn('Unable to show staging logs, no stage id');
    }

    // /namespaces/:namespace/staging/:stage_id/logs
    let endpoint = `${ this.getUrl(this.meta?.namespace, stageId) }/logs`;

    endpoint = endpoint.replace('/api/v1', '/wapi/v1');
    endpoint = endpoint.replace('/applications', '/staging');

    this.$dispatch('wm/open', {
      id:        `${ this.stagingLog }${ stageId }`,
      label:     `${ this.meta.name } - Build - ${ stageId }`,
      product:   EPINIO_PRODUCT_NAME,
      icon:      'file',
      component: 'ApplicationLogs',
      attrs:     {
        application: this,
        endpoint,
        ansiToHtml:  true
      }
    }, { root: true });
  }

  closeWindows() {
    // Closes appShell & appLogs on app Remove.
    this.$dispatch('wm/close', this.appShellId, { root: true });
    this.$dispatch('wm/close', this.appLogId, { root: true });

    // Closes all builds logs on app Remove.
    const allTabs = this.$rootGetters['wm/allTabs'];

    if ( allTabs.length > 0 ) {
      allTabs.forEach((e) => {
        if (e.id.startsWith(this.stagingLog)) {
          this.$dispatch('wm/close', e.id, { root: true });
        }
      });
    }
  }

  async remove() {
    this.closeWindows();

    await super.remove();
  }

  bulkRemove(items, opt) {
    return bulkRemove(items, opt);
  }

  async waitForStaging(stageId, iteration = 0) {
    this.trace('Waiting for Application bits to be staged');

    const opt = {
      url:     this.$getters['urlFor'](this.type, this.id, { url: `/api/v1/namespaces/${ this.meta.namespace }/staging/${ stageId }/complete` }),
      method:  'get',
      headers: {
        'content-type': 'application/json',
        accept:         'application/json'
      },
    };

    try {
      await this.$dispatch('request', { opt, type: this.type });
    } catch (e) {
      if (e._status === 500 && iteration === 0) {
        // On fresh epinio's the first stage/build takes some time. Ideally we'd poll for the staging state, but this isn't available,
        // so be patient and give the same request another try
        await this.waitForStaging(stageId, 1);
      } else {
        throw e;
      }
    }
  }

  async deploy(stageId, image, origin) {
    this.trace('Deploying Application bits');

    const stage = { };

    if (stageId) {
      stage.id = stageId;
    }

    try {
      const res = await this.followLink('deploy', {
        method:  'post',
        headers: { 'content-type': 'application/json' },
        data:    {
          app: {
            name:      this.meta.name,
            namespace: this.meta.namespace
          },
          stage,
          image,
          origin
        }
      });

      this.route = res.route;
    } catch (e) {
      if (e.errors?.[0].status === 500) {
        // On fresh epinio's the first deploy takes some time, so give the app some more time.
        // Note - this will do the same for any 500... as we dont have a status code for the timeout
        await this.waitForPseudoDeploy(e);
      } else {
        throw e;
      }
    }
  }

  async waitForPseudoDeploy(origError) {
    this.trace('Wait for deploy might have timed out, give the app more time');
    await this.waitForTestFn(() => {
      // Looking at their code the deploy request waits for the helm install command to return so we'd need something like the helm apps
      // 'deployed' status. Unfortunately we don't have that... so wait for ready === desired replica sets instead
      const fresh = this.$getters['byId'](EPINIO_TYPES.APP, `${ this.meta.namespace }/${ this.meta.name }`);

      if (fresh.deployment?.readyreplicas === fresh.deployment?.desiredreplicas && fresh.deployment.state === APPLICATION_ACTION_STATE.SUCCESS) {
        return true;
      }
      // This is an async fn, but we're in a sync fn. It might create a backlog if previous requests don't complete in time
      fresh.forceFetch();
    }, `app ready replicas = desired`, 20000, 2000).catch((err) => {
      console.warn(
        'Original timeout request failed, also failed to wait for pseudo deployed state', 
        err
      );
      throw origError;
    });
  }

  async restart() {
    await this.followLink('restart', { method: 'post' });
    await this.forceFetch();
    this.showAppLog();
  }

  async createManifest() {
    const date = new Date().toISOString().split('.')[0];
    const fileName = `${ this.metadata.namespace }-${ this.nameDisplay }-${ date }.yaml`;

    const manifest = await this.fetchPart('manifest');

    downloadFile(fileName, manifest, 'application/yaml').catch((e) => {
      console.error('Failed to download manifest: ', e);
    });
  }

  async updateConfigurations(initialValues = [], currentValues = this.configuration.configurations) {
    const toBind = currentValues.filter((cV) => !initialValues.includes(cV));
    const toUnbind = initialValues.filter((cV) => !currentValues.includes(cV));

    await Promise.all([
      this.bindConfigurations(toBind),
      this.unbindConfiguration(toUnbind),
    ]);
  }

  async bindConfigurations(configurations) {
    if (!configurations?.length) {
      return;
    }

    const opt = {
      url:    `${ this.linkFor('configBinding') }`,
      method: 'post',
      data:   { names: configurations }
    };

    await this.$dispatch('request', { opt, type: this.type } );
  }

  async unbindConfiguration(configurations) {
    if (!configurations?.length) {
      return;
    }

    const promises = configurations.map((c) => {
      const opt = {
        url:    `${ this.linkFor('configBinding') }/${ c }`,
        method: 'delete',
      };

      return this.$dispatch('request', { opt, type: this.type } );
    });

    return await Promise.all(promises);
  }

  async updateServices(initialValues = [], currentValues = []) {
    const toBind = currentValues.filter((cV) => !initialValues.includes(cV));
    const toUnbind = initialValues.filter((cV) => !currentValues.includes(cV));

    await Promise.all([
      ...toBind.map((s) => s.bindApp(this.meta.name)),
      ...toUnbind.map((s) => s.unbindApp(this.meta.name)),
    ]);
  }
}
