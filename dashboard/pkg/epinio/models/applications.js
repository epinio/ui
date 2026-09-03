import { classify } from '@shell/plugins/dashboard-store/classify';
import { downloadFile } from '@shell/utils/download';
import { formatSi } from '@shell/utils/units';
import { identity, pickBy } from 'lodash';
import { epiniofy } from '../store/epinio-store/actions';
import {
  APPLICATION_ACTION_STATE,
  APPLICATION_MANIFEST_SOURCE_TYPE,
  APPLICATION_SOURCE_TYPE,
  APPLICATION_PARTS,
  EPINIO_TYPES
} from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import EpinioNamespacedResource, { bulkRemove } from './epinio-namespaced-resource';
import { AppUtils } from '../utils/application';
import { openTab, closeTab, closeTabsMatching } from '../utils/dock-state';
import { WORKLOAD_TYPES } from '@shell/config/types';
import { NAME as EXPLORER } from '@shell/config/product/explorer';
// See https://github.com/epinio/epinio/blob/00684bc36780a37ab90091498e5c700337015a96/pkg/api/core/v1/models/app.go#L11
const STATES = {
  CREATING:  'created',
  STAGING:   'staging',
  DEPLOYING: 'deploying',
  RUNNING:   'running',
  ERROR:     'error',
};

// These map to @shell/plugins/dashboard-store/resource-class STATES
const STATES_MAPPED = {
  [STATES.CREATING]:  'created',
  [STATES.STAGING]:   'building',
  [STATES.DEPLOYING]: 'deploying',
  [STATES.RUNNING]:   'running',
  [STATES.ERROR]:     'error',
  unknown:            'unknown',
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

  get _availableActions() {
    const base = super._availableActions || [];

    const canGetter = this.$rootGetters?.['epinio/can'];
    const perms = this.$rootGetters?.['epinio/permissions']?.();

    // When permissions haven't loaded, show all actions — API enforces RBAC
    if (!canGetter || !perms || Object.keys(perms).length === 0) {
      return base;
    }

    const canEdit = canGetter('app_update') || canGetter('app_write') || canGetter('app');
    const canDelete = canGetter('app_delete') || canGetter('app_write') || canGetter('app');
    const canViewConfig = canGetter('configuration_read') || canGetter('configuration_write');
    const canEditConfig = canGetter('configuration_write') || canGetter('configuration');
    const canExec = canGetter('app_exec') || canGetter('app');

    let skipNextDivider = false;

    return base.filter((action) => {
      if (skipNextDivider && action.divider) {
        skipNextDivider = false;

        return false;
      }

      if (action.action === 'showAppShell') {
        return canExec;
      }

      if (action.action === 'showConfiguration') {
        if (!canViewConfig) {
          skipNextDivider = true; // base always has a divider after showConfiguration

          return false;
        }
        return false;
      }

      // Anything that mutates the resource needs app write perms.
      // Rancher's base Resource class injects goToEdit, goToEditYaml,
      // goToClone, cloneYaml, etc. — gate them all by canEdit so a
      // read-only role doesn't see "Edit YAML" / "Clone" entries.
      if (
        action.action === 'goToEdit' ||
        action.action === 'goToEditYaml' ||
        action.action === 'goToClone' ||
        action.action === 'cloneYaml'
      ) {
        return canEdit;
      }

      if (action.action === 'goToViewConfig') {
        // "Edit Config" menu entry should only be shown to users
        // who actually have configuration write permissions.
        return canEditConfig;
      }

      if (action.action === 'promptRemove') {
        return canDelete;
      }

      return true;
    });
  }

  // Used by ResourceDetailDrawer (Show Configuration) to show/hide the "Edit Config" button.
  // Require configuration_write so view-only users don't see it.
  get canEdit() {
    const base = this.canUpdate && this.canCustomEdit;
    const canGetter = this.$rootGetters?.['epinio/can'];
    const perms = this.$rootGetters?.['epinio/permissions']?.();
    if (!canGetter || !perms || Object.keys(perms).length === 0) {
      return false;
    }
    const canEditConfig = canGetter('configuration_write') || canGetter('configuration');
    return !!(base && canEditConfig);
  }

  get canRestartAfterConfigSave() {
    return this.status === STATES.RUNNING && !!this.image_url;
  }

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
    case STATES.DEPLOYING:
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

  get availableActions() {
    const res = [];

    const isRunning = [STATES.RUNNING].includes(this.status);
    const isErroring = [STATES.ERROR].includes(this.status);
    const isStaging = this.status === STATES.STAGING
      || this.status === STATES.DEPLOYING
      || this.stagingstatus === 'active';
    const canGetter = this.$rootGetters?.['epinio/can'];
    const perms = this.$rootGetters?.['epinio/permissions']?.();
    const permsReady = !!(canGetter && perms && Object.keys(perms).length > 0);
    // Until /me resolves we hide everything action-y rather than flashing
    // controls the user lacks permission for. Matches showAppShell behavior.
    const can = (id) => permsReady && canGetter(id);

    // `app` is the top-level umbrella granting every app-scoped action.
    // `app_write` is a write-side umbrella that pulls in all stage/restart/export
    // actions per actions.yaml dependsOn. Logs and exec are not under
    // app_write — they only collapse into the `app` umbrella.
    const canExec = can('app_exec') || can('app');
    const canLogs = can('app_logs') || can('app');
    const canStage = can('app_stage') || can('app_write') || can('app');
    const canRestart = can('app_restart') || can('app_write') || can('app');
    const canExport = can('app_export') || can('app_write') || can('app');

    const showAppShell = isRunning && canExec;
    const showAppLog = (isRunning || isErroring) && canLogs;
    const showStagingLog = !!this.stage_id && canLogs;

    if (showAppShell) {
      res.push({
        action:  'showAppShell',
        label:   this.t('epinio.applications.actions.shell.label'),
        icon:    'icon icon-fw icon-terminal',
        enabled: showAppShell,
      });
    }
    if (canLogs) {
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
    }

    if (canStage) {
      res.push({
        action:  'restage',
        label:   this.t('epinio.applications.actions.restage.label'),
        icon:    'icon icon-fw icon-backup',
        enabled: this.canRetryBuild && !isStaging,
      });
    }
    if (canRestart) {
      res.push({
        action:  'restart',
        label:   this.t('epinio.applications.actions.restart.label'),
        icon:    'icon icon-fw icon-refresh',
        enabled: isRunning
      });
    }
    if (canExport) {
      res.push({
        action:  'exportApp',
        label:   this.t('epinio.applications.export.label'),
        icon:    'icon icon-fw icon-download',
        enabled: isRunning
      });
    }
    res.push({ divider: true });

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
      ...this._availableActions
    );

    return this._pruneOrphanedDividers(res);
  }

  /**
   * Rebuild/retry is allowed when source can be reused:
   * - git origin (backend can re-clone if blob is gone)
   * - stored blobuid (local/folder/archive upload still in S3/seaweedfs)
   * Container images cannot be restaged.
   */
  get canRetryBuild() {
    const sourceType = AppUtils.getSourceType(this.origin);

    if (sourceType === APPLICATION_SOURCE_TYPE.CONTAINER_URL) {
      return false;
    }

    const hasGit = !!(this.origin?.git?.repository || this.origin?.git?.url);
    const hasBlob = !!this.blobuid;

    return hasGit || hasBlob;
  }

  /**
   * Normalize API origin into the shape async deploy expects, without wiping
   * source metadata when Kind is missing from the client model.
   */
  get retryDeployOrigin() {
    const origin = this.origin || {};
    const sourceType = AppUtils.getSourceType(origin);

    if (sourceType === APPLICATION_SOURCE_TYPE.CONTAINER_URL) {
      return {
        kind:      APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER,
        container: origin.container,
      };
    }

    if (origin.git?.repository || origin.git?.url) {
      return {
        kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
        git:  {
          repository: origin.git.repository || origin.git.url,
          revision:   origin.git.revision,
          branch:     origin.git.branch,
          provider:   origin.git.provider,
          gitconfig:  origin.git.gitconfig,
        },
      };
    }

    if (origin.path) {
      return {
        kind:    APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
        path:    origin.path,
        archive: !!origin.archive,
      };
    }

    return origin;
  }

  _pruneOrphanedDividers(actions) {
    // Remove disabled items and consecutive dividers (mirrors resource-class availableActions logic)
    let last = null;
    let out = actions.filter((item) => {
      if (item.enabled === false) {
        return false;
      }

      const cur = item.divider;
      const ok = !cur || (cur && !last);

      last = cur;

      return ok;
    });

    // Remove dividers at the beginning
    while (out.length && out[0].divider) {
      out.shift();
    }

    // Remove dividers at the end
    while (out.length && out[out.length - 1].divider) {
      out.pop();
    }

    // Remove consecutive dividers in the middle
    for (let i = 1; i < out.length; i++) {
      if (out[i].divider && out[i - 1].divider) {
        out.splice(i, 1);
        i--;
      }
    }

    return out;
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
      deployments:   `${ this.getUrl() }/deployments`,
      configBinding: `${ this.getUrl() }/configurationbindings`,
      logs:          `${ this.getUrl() }/logs`.replace('/api/v1', '/wapi/v1'), // /namespaces/:namespace/applications/:app/logs
      importGit:     `${ this.getUrl() }/import-git`,
      restart:       `${ this.getUrl() }/restart`,
      shell:         `${ this.getUrl() }/exec?tty=true`.replace('/api/v1', '/wapi/v1'), // /namespaces/:namespace/applications/:app/exec
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
    return this.deployment?.desiredreplicas ?? this.configuration?.instances ?? 0;
  }

  //Fallback to configuration.instances if deployment.desiredreplicas is not
  //available.
  set desiredInstances(neu) {
    if (this.deployment) {
      this.deployment.desiredreplicas = neu;
    }
    if (this.configuration) {
      this.configuration.instances = neu;
    }
  }

  get readyInstances() {
    return this.deployment?.readyreplicas ?? 0;
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
        url:    this.origin.git?.repository || '',
        gitconfig: this.origin.git?.gitconfig || '',
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
        buildMode:    this.staging.buildMode,
        dockerfilePath: this.staging.dockerfilePath,
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
      archive:   source.archive,
      builderImage: source.builderImage,
      buildMode:    source.buildMode,
      dockerfilePath: source.dockerfilePath,
    };
  }

  get appSourceInfo() {
    const { source } = this.appData;

    const appChart = {
      label: 'App Chart',
      value: source.appchart
    };

    var builder;
    if (source?.buildMode === 'dockerfile') {
      builder = {
        label: 'Dockerfile Path',
        value: source.dockerfilePath
      }
    } else {
      builder = {
        label: 'Builder Image',
        value: source.builderImage
      };
    }

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
          }, appChart, builder
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
          }, appChart, builder
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
          }, appChart, builder
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

  get metricsOk() {
    const replicas = this.deployment?.replicas;

    if (!replicas) {
      return true;
    }

    const replicaList = Object.values(replicas);

    if (replicaList.length === 0) {
      return true;
    }

    return replicaList.every((r) => r.metricsOk);
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
      }).catch((e) => {
        console.log(e);
        this.$dispatch('growl/error', {
          title:   this.t('epinio.growl.application.deployment.error.title'),
          message: this.t('epinio.growl.application.deployment.error.message'),
        }, { root: true });
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
          configurations: this.configuration.configurations.map((c) => c.meta.name),
          environment:    this.configuration.environment,
          routes:         this.configuration.routes.length ? this.configuration.routes : null,
        }
      }
    });
  }

  async gitFetch(url, rev, gitconfig) {
    this.trace('Downloading and storing git repo');
    const formData = new FormData();

    formData.append('giturl', url);
    formData.append('gitrev', rev );
    if (gitconfig) {
      formData.append('gitconfig', gitconfig);
    }

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
        configurations: this.configuration.configurations.map((c) => c.meta.name),
        settings:       pickBy(this.configuration?.settings, identity) || null,
        environment:    this.configuration.environment,
        // Replace the full env map so removals and renames match the form (API merges by default).
        replace_env:    true,
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

  async stage(blobuid, builderImage, buildMode, dockerfilePath) {
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
        builderimage: builderImage,
        buildmode:      buildMode,
        dockerfilepath: dockerfilePath,
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
    this.$dispatch('growl/info', {
      title:   this.t('epinio.growl.application.restage.info.title'),
      message: this.t('epinio.growl.application.restage.info.message'),
    }, { root: true });
    try {
      if (!this.canRetryBuild) {
        throw new Error('No reusable source available to rebuild');
      }
      
      const { builderImage, buildMode, dockerfilePath } = this.appSource;
      
      // Never-deployed / failed first push: stage + deploy using stored blob or git.
      // Already-deployed apps: restage only (optionally restart when running).
      if (!this.deployment) {
        this.buildCache = {};
        this.clearPersistedAsyncDeploymentId();
        // Keep existing origin so async deploy does not wipe source metadata.
        await this.waitAsyncDeployPhase({
          blobUid:      this.blobuid || undefined,
          builderImage,
          origin:       this.retryDeployOrigin,
        });
        await this.forceFetch();
        if (this.stage_id) {
          this.showStagingLog(this.stage_id);
        }
      } else {
        const { stage } = await this.stage(undefined, builderImage, buildMode, dockerfilePath);

        await this.forceFetch();
        this.showStagingLog(stage.id);
        await this.waitForStaging(stage.id);

        if (this.status === STATES.RUNNING) {
          await this.restart();
        }
      }
      
      await this.forceFetch();
      this.$dispatch('growl/success', {
        title:   this.t('epinio.growl.application.restage.success.title'),
        message: this.t('epinio.growl.application.restage.success.message', { name: this.meta.name }),
      }, { root: true });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.restage.error.title'),
        message: e?.message || this.t('epinio.growl.application.restage.error.message'),
      }, { root: true });
    }
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
    try {
      const initialInstance = this.instances?.[0]?.id;

      if (!initialInstance) {
        throw new Error('No running instances available');
      }

      openTab({
        id:        this.appShellId,
        label:     `${ this.meta.name } - App Shell`,
        icon:      'chevronRight',
        component: 'ApplicationShell',
        props:     {
          application:     this,
          endpoint:        this.linkFor('shell'),
          initialInstance,
        }
      });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.shell.error.title'),
        message: this.t('epinio.growl.application.shell.error.message'),
      }, { root: true });
    }
  }

  showAppLog() {
    try {
      openTab({
        id:        this.appLogId,
        label:     `${ this.meta.name } - App Logs`,
        icon:      'file',
        component: 'ApplicationLogs',
        props:     {
          application: this,
          endpoint:    this.linkFor('logs')
        }
      });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.appLogs.error.title'),
        message: this.t('epinio.growl.application.appLogs.error.message'),
      }, { root: true });
    }
  }

  showStagingLog(stageId = this.stage_id) {
    if (!stageId) {
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.buildLogs.noInfo.title'),
        message: this.t('epinio.growl.application.buildLogs.noInfo.message', { name: this.meta.name }),
      }, { root: true });

      return;
    }

    try {
      // /namespaces/:namespace/staging/:stage_id/logs
      let endpoint = `${ this.getUrl(this.meta?.namespace, stageId) }/logs`;

      endpoint = endpoint.replace('/api/v1', '/wapi/v1');
      endpoint = endpoint.replace('/applications', '/staging');

      openTab({
        id:        `${ this.stagingLog }${ stageId }`,
        label:     `${ this.meta.name } - Build - ${ stageId }`,
        icon:      'file',
        component: 'ApplicationLogs',
        props:     {
          application: this,
          endpoint,
          ansiToHtml:  true
        }
      });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.buildLogs.error.title'),
        message: this.t('epinio.growl.application.buildLogs.error.message'),
      }, { root: true });
    }
  }

  closeWindows() {
    // Closes appShell & appLogs on app Remove.
    closeTab(this.appShellId);
    closeTab(this.appLogId);

    // Closes all builds logs on app Remove.
    closeTabsMatching(this.stagingLog);
  }

  async remove(opt = { data: {unmounted: true} } ) {
    this.closeWindows();

    // Check if deleteImage flag is set on the resource
    if (this._deleteImage) {
      opt.data.deleteImage = true;
    }

    // Check if deleteAppPVC flag is set on the resource
    if (this._deletePVC) {
      opt.data.deletePVC = true;
    }

    await super.remove(opt);
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

  asyncDeployStorageKey() {
    return `epinio.async-deploy.${ this.meta.namespace }.${ this.meta.name }`;
  }

  persistAsyncDeploymentId(deploymentId) {
    if (!deploymentId) {
      return;
    }
    try {
      localStorage.setItem(this.asyncDeployStorageKey(), deploymentId);
    } catch (e) {
      console.log(e);
    }
  }

  readPersistedAsyncDeploymentId() {
    try {
      return localStorage.getItem(this.asyncDeployStorageKey()) || undefined;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  clearPersistedAsyncDeploymentId() {
    try {
      localStorage.removeItem(this.asyncDeployStorageKey());
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  extractDeploymentPayload(response) {
    if (!response) {
      return response;
    }

    // Different request wrappers may return payload in different slots.
    return response?.data?.data || response?.data || response;
  }

  extractDeploymentId(payload) {
    return payload?.id ||
      payload?.deployment_id ||
      payload?.deploymentId ||
      payload?.status?.id ||
      payload?.data?.id;
  }

  extractDeploymentIdFromLocation(location) {
    if (!location || typeof location !== 'string') {
      return undefined;
    }

    // Accept either absolute or relative Location header values.
    const normalized = location.split('?')[0].replace(/\/+$/, '');
    const parts = normalized.split('/');

    return parts[parts.length - 1] || undefined;
  }

  extractDeploymentIdFromResponse(response, payload) {
    // The Location header is the authoritative source — the shell request wrapper
    // runs bodies through epiniofy, which overwrites `id` with createId() and loses
    // the server's deployment id when the body has no meta.name / name.
    const headers = response?._headers || response?.headers || response?.response?.headers || {};
    const location = headers?.location || headers?.Location;
    const locationId = this.extractDeploymentIdFromLocation(location);

    if (locationId) {
      return locationId;
    }

    const payloadId = this.extractDeploymentId(payload);
    if (payloadId) {
      return payloadId;
    }

    return this.extractDeploymentId(response);
  }

  /**
   * Build phase: wait until server leaves staging (async) or finish client-side stage+wait (sync fallback).
   * Container sources skip this step.
   */
  async waitAsyncBuildPhase({ blobUid, builderImage, buildMode, dockerfilePath, image, origin, isContainer }) {
    this.trace('Async build phase');
    if (isContainer) {
      return;
    }
    await this.ensureAsyncDeployStarted({ blobUid, builderImage, buildMode, dockerfilePath, image, origin });
    if (this.buildCache.deployMode === 'sync') {
      await this.buildSyncOnly(blobUid, builderImage, buildMode, dockerfilePath);
      return;
    }
    const id = this.buildCache.asyncDeployDeploymentId;
    if (!id) {
      // Async deploy was accepted but no id was visible to the client/proxy wrapper.
      // Do not fallback to sync build to avoid duplicate stage jobs.
      return;
    }
    const status = await this.pollDeploymentUntil(id, (s) => ['deploying', 'succeeded', 'failed'].includes(s.status));
    if (status?.status === 'failed') {
      const err = new Error(status?.error || 'Build failed');
      err.status = status;
      throw err;
    }
  }

  /**
   * Deploy phase: wait for terminal async status or run sync deploy (fallback).
   */
  async waitAsyncDeployPhase({ blobUid, builderImage, buildMode, dockerfilePath, image, origin }) {
    this.trace('Async deploy phase');
    await this.ensureAsyncDeployStarted({ blobUid, builderImage, buildMode, dockerfilePath, image, origin });
    if (this.buildCache.deployMode === 'sync') {
      await this.deploySyncOnly({ image, origin });
      await this.forceFetch();
      return;
    }
    const id = this.buildCache.asyncDeployDeploymentId;

    if (id) {
      await this.waitForDeployment(id);
      return;
    }

    // Some intermediaries can strip async response bodies/headers.
    // If async deploy was started but no id is available, poll app status
    // instead of switching to sync path (which can get stuck on refresh).
    await this.waitForAppReadyOrError();
    this.clearPersistedAsyncDeploymentId();
    await this.forceFetch();
  }

  async ensureAsyncDeployStarted({ blobUid, builderImage, buildMode, dockerfilePath, image, origin }) {
    this.buildCache = this.buildCache || {};
    if (this.buildCache.deployMode === 'sync' || this.buildCache.asyncDeployDeploymentId) {
      return;
    }

    // Try to resume an in-flight async deployment after UI reload.
    const persistedId = this.readPersistedAsyncDeploymentId();
    if (persistedId) {
      try {
        await this.getDeploymentStatus(persistedId);
        this.buildCache.asyncDeployDeploymentId = persistedId;
        return;
      } catch (e) {
        console.log(e);
        // Stale id, start a fresh async deployment.
        this.clearPersistedAsyncDeploymentId();
      }
    }

    const opt = {
      url:     this.linkFor('deployments'),
      method:  'post',
      headers: { 'content-type': 'application/json' },
      // Bypass the epinio store's epiniofy() transform, which overwrites the body's
      // `id` field (via createId) and costs us the server's deployment id.
      responseType: 'json',
      data:    {
        app: {
          name:      this.meta.name,
          namespace: this.meta.namespace
        },
        blobuid:      blobUid,
        builderimage: builderImage,
        buildmode:      buildMode,
        dockerfilepath: dockerfilePath,
        image,
        origin
      }
    };

    let deployment;
    let deploymentId;

    try {
      const response = await this.$dispatch('request', { opt, type: this.type });
      // With responseType set, `response` is the raw axios response: {data, headers, ...}.
      deployment = response?.data ?? response;
      deploymentId = this.extractDeploymentIdFromResponse(response, deployment);
    } catch (e) {
      const status = e?._status || e?.errors?.[0]?.status;

      // Only fallback when server does not support async deployment endpoints.
      if (status === 404 || status === 405 || status === 500 || status === 502 || status === 503 || status === 504) {
        this.buildCache.deployMode = 'sync';
        this.clearPersistedAsyncDeploymentId();
        return;
      }

      throw e;
    }

    if (!deploymentId) {
      // Async start succeeded but deployment id is not visible to the client.
      // Keep async mode and let deploy phase poll app status as a fallback.
      this.buildCache.deployment = deployment;
      return;
    }

    this.buildCache.asyncDeployDeploymentId = deploymentId;
    this.buildCache.deployment = deployment;
    this.persistAsyncDeploymentId(deploymentId);
  }

  async buildSyncOnly(blobUid, builderImage, buildMode, dockerfilePath) {
    this.trace('Sync build (stage) only');
    const { image: builtImage, stage } = await this.stage(blobUid, builderImage, buildMode, dockerfilePath);
    this.buildCache.stageForSync = { stage, image: builtImage };
    if (stage?.id) {
      this.showStagingLog(stage.id);
      await this.waitForStaging(stage.id);
    }
  }

  async deploySyncOnly({ image, origin }) {
    this.trace('Sync deploy only');
    const stageId = this.buildCache.stageForSync?.stage?.id;
    const imageToDeploy = image ?? this.buildCache.stageForSync?.image;

    const stage = {};
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
          image: imageToDeploy,
          origin
        }
      });

      this.route = res.route;
    } catch (e) {
      if (e.errors?.[0].status === 500) {
        await this.waitForPseudoDeploy(e);
      } else {
        throw e;
      }
    }
  }

  async pollDeploymentUntil(deploymentId, donePred, { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {}) {
    const start = Date.now();
    let stagingLogShown = false;

    while (true) {
      const status = await this.getDeploymentStatus(deploymentId);

      if (status?.stage_id && !stagingLogShown) {
        stagingLogShown = true;
        this.showStagingLog(status.stage_id);
      }

      if (donePred(status)) {
        return status;
      }

      if (status?.status === 'failed') {
        return status;
      }

      if (Date.now() - start > timeoutMs) {
        const err = new Error('Timed out waiting for deployment');
        err.status = status;
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  async getDeploymentStatus(deploymentId) {
    const opt = {
      url:          `${ this.linkFor('deployments') }/${ deploymentId }`,
      method:       'get',
      responseType: 'json',
    };

    const response = await this.$dispatch('request', { opt, type: this.type });

    return response?.data ?? response;
  }

  async waitForDeployment(deploymentId, { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {}) {
    const start = Date.now();
    let stagingLogShown = false;

    while (true) {
      const status = await this.getDeploymentStatus(deploymentId);

      // Once staging begins, we can show staging logs
      if (status?.stage_id && !stagingLogShown) {
        stagingLogShown = true;
        this.showStagingLog(status.stage_id);
      }

      if (status?.status === 'succeeded') {
        this.clearPersistedAsyncDeploymentId();
        await this.forceFetch();
        return status;
      }

      if (status?.status === 'failed') {
        this.clearPersistedAsyncDeploymentId();
        const err = new Error(status?.error || 'Deployment failed');
        err.status = status;
        throw err;
      }

      if (Date.now() - start > timeoutMs) {
        const err = new Error('Timed out waiting for deployment');
        err.status = status;
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  async waitForAppReadyOrError({ timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {}) {
    const start = Date.now();

    while (true) {
      await this.forceFetch();
      const fresh = this.$getters['byId'](EPINIO_TYPES.APP, `${ this.meta.namespace }/${ this.meta.name }`) || this;
      const status = fresh?.status;

      if (status === STATES.RUNNING) {
        return;
      }

      if (status === STATES.ERROR) {
        throw new Error(fresh?.statusmessage || 'Deployment failed');
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error('Timed out waiting for deployment');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
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
    this.$dispatch('growl/info', {
      title:   this.t('epinio.growl.application.restart.info.title'),
      message: this.t('epinio.growl.application.restart.info.message'),
    }, { root: true });

    try {
      await this.followLink('restart', { method: 'post' });
      await this.forceFetch();
      this.showAppLog();
      this.$dispatch('growl/success', {
        title:   this.t('epinio.growl.application.restart.success.title'),
        message: this.t('epinio.growl.application.restart.success.message', { name: this.meta.name }),
      }, { root: true });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.restart.error.title'),
        message: this.t('epinio.growl.application.restart.error.message'),
      }, { root: true });
    }
  }

  async createManifest() {
    try {
      const date = new Date().toISOString().split('.')[0];
      const fileName = `${ this.metadata.namespace }-${ this.nameDisplay }-${ date }.yaml`;

      const manifest = await this.fetchPart('manifest');

      await downloadFile(fileName, manifest, 'application/yaml');
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.manifest.error.title'),
        message: this.t('epinio.growl.application.manifest.error.message'),
      }, { root: true });
      throw e;
    }
  }

  async updateConfigurations(initialValues = [], currentValues = this.configuration.configurations) {
    // Compare by name: the two sides come from separate fetches, so the same
    // configuration is a different object instance in each and `includes` never hits.
    const nameOf = (c) => c?.meta?.name;
    const initialNames = initialValues.filter(c => !c.isServiceRelated).map(nameOf);
    const currentNames = currentValues.filter(c => !c.isServiceRelated).map(nameOf);

    const toBind = currentNames.filter((c) => !initialNames.includes(c));
    const toUnbind = initialNames.filter((c) => !currentNames.includes(c));

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
    // Compare by name: the two sides come from separate fetches, so the same
    // service is a different object instance in each and `includes` never hits.
    const nameOf = (s) => s?.meta?.name;
    const initialNames = initialValues.map(nameOf);
    const currentNames = currentValues.map(nameOf);

    const toBind = currentValues.filter((s) => !initialNames.includes(nameOf(s)));
    const toUnbind = initialValues.filter((s) => !currentNames.includes(nameOf(s)));

    await Promise.all([
      ...toBind.map((s) => s.bindApp(this.meta.name)),
      ...toUnbind.map((s) => s.unbindApp(this.meta.name)),
    ]);
  }
}
