import {
  APPLICATION_ACTION_STATE,
  APPLICATION_MANIFEST_SOURCE_TYPE,
  APPLICATION_SOURCE_TYPE,
  EPINIO_PRODUCT_NAME
} from '../types';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import Resource from '@shell/plugins/dashboard-store/resource-class';
import { set } from '@shell/utils/object';

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

interface Source {
  git?: {
    commit?: string;
    url?: string;
    branch?: {
      name: string;
    };
  };
  gitUrl?: {
    branch?: string;
    url?: string;
  };
  archive?: {
    tarball: string;
    fileName: string;
  };
  container?: {
    url: string;
  };
  type: string;
}

interface Application {
  meta: {
    namespace: string;
  };
  create: () => Promise<void>;
  update: (arg1: any) => Promise<void>;
  updateConfigurations: (arg1: any[], arg2: any) => Promise<void>;
  updateServices: (arg1: any[], arg2: any) => Promise<void>;
  storeArchive: (tarball: string) => Promise<void>;
  gitFetch: (url: string, rev?: string) => Promise<void>;
  stage: (blobUid: string, builderImage: string) => Promise<{ stage: { id: string } }>;
  waitForStaging: (stageId: string) => Promise<void>;
  deploy: (stageId: string | null, image: string, origin: any) => Promise<void>;
  showStagingLog: (stageId: string) => void;
  showAppLog: () => void;
  buildCache: {
    store: {
      blobUid: string;
    };
    stage: {
      stage: { id: string };
      image: string;
    };
  };
}

export default class ApplicationActionResource extends Resource {
  run: boolean = true;
  state: string = APPLICATION_ACTION_STATE.PENDING;
  action: string;
  application: Application;
  bindings?: {
    configurations: any;
    services: any;
  };
  stateMessage?: string;

  constructor(
    data: {
      action: string, 
      application: Application,
    },
    ctx: any,
  ){
    super(data, ctx);
    this.action = data.action;
    this.application = data.application;
  }

  get name(): string {
    return this.t(`epinio.applications.action.${this.action}.label`);
  }

  get description(): string {
    return this.t(`epinio.applications.action.${this.action}.description`);
  }

  get stateObj(): { name: string; error: boolean; transitioning: boolean, message?: string } {
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

  async execute(params: any): Promise<void> {
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

  async innerExecute(params: any): Promise<void> {
    switch (this.action) {
      case APPLICATION_ACTION_TYPE.CREATE_NS:           return this.createNamespace();
      case APPLICATION_ACTION_TYPE.CREATE:              return this.create();
      case APPLICATION_ACTION_TYPE.UPDATE_SOURCE:       return this.updateSource();
      case APPLICATION_ACTION_TYPE.BIND_CONFIGURATIONS: return this.bindConfigurations();
      case APPLICATION_ACTION_TYPE.BIND_SERVICES:       return this.bindServices();
      case APPLICATION_ACTION_TYPE.GIT_FETCH:           return this.gitFetch(params);
      case APPLICATION_ACTION_TYPE.UPLOAD:              return this.upload(params);
      case APPLICATION_ACTION_TYPE.BUILD:
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
    await this.application.updateConfigurations([], this.bindings?.configurations);
  }

  async bindServices() {
    await this.application.updateServices([], this.bindings?.services);
  }

  async upload(source: Source) {
    const tarball = source.archive?.tarball || '';
    await this.application.storeArchive(tarball);
  }

  async gitFetch(source: Source) {
    const rev = source.git?.commit || source.gitUrl?.branch || '';
    const url = source.git?.url || source.gitUrl?.url || '';

    return await this.application.gitFetch(url, rev);
  }

  async build(source: any) {
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

  async deploy(source: any) {
    const stageId = source.type === APPLICATION_SOURCE_TYPE.ARCHIVE
      ? this.application.buildCache.stage.stage.id
      : null;

    const image = source.type === APPLICATION_SOURCE_TYPE.CONTAINER_URL
      ? source.container.url
      : this.application.buildCache.stage.image;

    await this.application.deploy(stageId, image, this.createDeployOrigin(source));
    this.application.showAppLog();
  }

  createDeployOrigin(source: Source) {
    switch (source.type) {
      case APPLICATION_SOURCE_TYPE.ARCHIVE:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
          archive: true,
          path: source.archive?.fileName || '',
        };
      case APPLICATION_SOURCE_TYPE.FOLDER:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
          path: source.archive?.fileName || '',
        };
      case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER,
          container: source.container?.url || '',
          path: source.archive?.fileName || '',
        };
      case APPLICATION_SOURCE_TYPE.GIT_URL:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
          git: {
            revision: source.gitUrl?.branch || '',
            repository: source.gitUrl?.url || '',
          },
        };
      case APPLICATION_SOURCE_TYPE.GIT_HUB:
      case APPLICATION_SOURCE_TYPE.GIT_LAB:
        return {
          kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
          git: {
            revision: source.git?.commit,
            repository: source.git?.url,
            branch: source.git?.branch?.name,
            provider: source.type,
          },
        };
    }
  }
}
