import { APPLICATION_ACTION_STATE, APPLICATION_MANIFEST_SOURCE_TYPE, APPLICATION_SOURCE_TYPE, EPINIO_PRODUCT_NAME } from '../types';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import Resource from '@shell/plugins/dashboard-store/resource-class';
import { set } from '@shell/utils/object'; // Vue 3-compatible reactivity setter

export const APPLICATION_ACTION_TYPE = {
  CREATE_NS:           'create_namespace',
  CREATE:              'create',
  UPDATE_SOURCE:       'updateSource',
  GIT_FETCH:           'gitFetch',
  UPLOAD:              'upload',
  BIND_CONFIGURATIONS: 'bind_configurations',
  BIND_SERVICES:       'bind_services',
  BUILD:               'build',
  DEPLOY:              'deploy',
};

export default class ApplicationActionResource extends Resource {
  run = true;
  state = APPLICATION_ACTION_STATE.PENDING;

  get name() {
    return this.t(`epinio.applications.action.${ this.action }.label`);
  }

  get description() {
    return this.t(`epinio.applications.action.${ this.action }.description`);
  }

  get stateObj() {
    switch (this.state) {
      case APPLICATION_ACTION_STATE.SUCCESS:
        return { name: 'succeeded', error: false, transitioning: false };
      case APPLICATION_ACTION_STATE.RUNNING:
        return { name: 'pending', error: false, transitioning: true };
      case APPLICATION_ACTION_STATE.FAIL:
        return {
          name: 'fail', error: true, transitioning: false, message: this.stateMessage
        };
      case APPLICATION_ACTION_STATE.PENDING:
      default:
        return { name: 'pending', error: false, transitioning: false };
    }
  }

  async execute(params) {
    try {
      set(this, 'state', APPLICATION_ACTION_STATE.RUNNING);

      await this.innerExecute(params);

      set(this, 'state', APPLICATION_ACTION_STATE.SUCCESS);
      set(this, 'run', false);
    } catch (err) {
      set(this, 'state', APPLICATION_ACTION_STATE.FAIL);
      set(this, 'stateMessage', epinioExceptionToErrorsArray(err)[0].toString());
      throw err;
    }
  }

  async innerExecute(params) {
    switch (this.action) {
      case APPLICATION_ACTION_TYPE.CREATE_NS:           return this.createNamespace(params);
      case APPLICATION_ACTION_TYPE.CREATE:              return this.create(params);
      case APPLICATION_ACTION_TYPE.UPDATE_SOURCE:       return this.updateSource();
      case APPLICATION_ACTION_TYPE.BIND_CONFIGURATIONS: return this.bindConfigurations(params);
      case APPLICATION_ACTION_TYPE.BIND_SERVICES:       return this.bindServices(params);
      case APPLICATION_ACTION_TYPE.GIT_FETCH:           return this.gitFetch(params);
      case APPLICATION_ACTION_TYPE.UPLOAD:              return this.upload(params);
      case APPLICATION_ACTION_TYPE.BUILD:               return this.build(params);
      case APPLICATION_ACTION_TYPE.DEPLOY:              return this.deploy(params);
    }
  }

  async createNamespace() {
    const ns = await this.$dispatch(`${ EPINIO_PRODUCT_NAME }/createNamespace`, {
      name: this.application.meta.namespace
    }, { root: true });

    await ns.create();
  }

  async create() {
    await this.application.create();
  }

  async bindConfigurations() {
    await this.application.updateConfigurations([], this.bindings.configurations);
  }

  async bindServices() {
    await this.application.updateServices([], this.bindings.services);
  }

  async upload({ source }) {
    await this.application.storeArchive(source.archive.tarball);
  }

  async gitFetch({ source }) {
    const rev = source.git?.commit || source.gitUrl?.branch;
    const url = source.git?.url || source.gitUrl?.url;

    return await this.application.gitFetch(url, rev);
  }

  async build({ source }) {
    const { stage } = await this.application.stage(
      this.application.buildCache.store.blobUid,
      source.builderImage.value
    );

    this.application.showStagingLog(stage.id);
    await this.application.waitForStaging(stage.id);
  }

  async updateSource() {
    await this.application.update({ restart: false });
  }

  async deploy({ source }) {
    const stageId = source.type === APPLICATION_SOURCE_TYPE.ARCHIVE
      ? this.application.buildCache.stage.stage.id
      : null;

    const image = source.type === APPLICATION_SOURCE_TYPE.CONTAINER_URL
      ? source.container.url
      : this.application.buildCache.stage.image;

    await this.application.deploy(stageId, image, this.createDeployOrigin(source));
    this.application.showAppLog();
  }

  createDeployOrigin(source) {
    switch (source.type) {
      case APPLICATION_SOURCE_TYPE.ARCHIVE:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
          archive: true,
          path: source.archive.fileName,
        };
      case APPLICATION_SOURCE_TYPE.FOLDER:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
          path: source.archive.fileName,
        };
      case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER,
          container: source.container.url,
        };
      case APPLICATION_SOURCE_TYPE.GIT_URL:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
          git: {
            revision: source.gitUrl.branch,
            repository: source.gitUrl.url,
          },
        };
      case APPLICATION_SOURCE_TYPE.GIT_HUB:
      case APPLICATION_SOURCE_TYPE.GIT_LAB:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
          git: {
            revision: source.git.commit,
            repository: source.git.url,
            branch: source.git.branch?.name,
            provider: source.type,
          },
        };
    }
  }
}
