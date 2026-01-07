import EpinioAppChartModel from './models/appcharts';
import EpinioApplicationModel from './models/applications';
import EpinioCatalogServiceModel from './models/catalogservices';
import EpinioConfigurationModel from './models/configurations';
import EpinioServiceModel from './models/services';

export const TAPP = {
  DASHBOARD:           'tapp.io.dashboard'
};

export const EPINIO_PRODUCT_NAME = 'epinio';

export const EPINIO_MGMT_STORE = 'epiniomgmt';

// // An endpoint with this name is automatically created by the standalone backend
export const EPINIO_STANDALONE_CLUSTER_NAME = 'default';

export const EPINIO_TYPES = {
  // From API
  APP:              'applications',
  APP_CHARTS:       'appcharts',
  NAMESPACE:        'namespaces',
  CONFIGURATION:    'configurations',
  CATALOG_SERVICE:  'catalogservices',
  SERVICE_INSTANCE: 'services',
  // Internal
  DASHBOARD:        'dashboard',
  ABOUT:            'about',
  SUPPORT_BUNDLE:   'support-bundle',
  CLUSTER:          'epinio.io.management.cluster',
  APP_ACTION:       'application-action',
  APP_INSTANCE:     'application-instance',
};

// // https://github.com/epinio/epinio/blob/7eb93b6dc735f8a6db26b8a242ae62a34877014c/pkg/api/core/v1/models/models.go#L96
export const APPLICATION_MANIFEST_SOURCE_TYPE = {
  NONE:      0,
  PATH:      1,
  GIT:       2,
  CONTAINER: 3,
};

// ------------ App Source Info (used within the UI) --------------
export enum APPLICATION_SOURCE_TYPE {
  CONTAINER_URL = 'container_url',
  ARCHIVE = 'archive',
  FOLDER = 'folder',
  GIT_URL = 'git_url',
  GIT_HUB = 'github',
  GIT_LAB = 'gitlab',
}

export enum GitProvider {
  GIT = 'git',
  GIT_HUB = 'github',
  GIT_HUB_ENTERPRISE = 'github_enterprise',
  GIT_LAB = 'gitlab',
  GIT_LAB_ENTERPRISE = 'gitlab_enterprise',
  UNKNOWN = 'unknown'
}

export interface AppSourceArchive {
  tarball: string,
  fileName: string
}

export interface AppSourceContainer {
  url: string,
}

export interface AppSourceGitUrl {
  url: string,
  branch: string
}

export type GitAPIData = {
  repos: any[],
  branches: any[],
  commits: any[]
}

export interface AppSourceGit {
  usernameOrOrg?: string,
  repo: { id?: string, name: string },
  commit: string,
  branch: { id?: string, name: string },
  url: string,
  sourceData: GitAPIData
}

export interface AppSourceBuilderImage {
  value: string,
  default: boolean,
}

/**
 * Contains information used within a UI session to represent where an application came from
 */
export interface EpinioAppSource {
  type: string,
  archive?: AppSourceArchive | undefined,
  container: AppSourceContainer,
  git: AppSourceGit,
  gitUrl: AppSourceGitUrl,
  builderImage?: AppSourceBuilderImage,
  appChart: string,
}

export type EPINIO_APP_GIT_SOURCE = Omit<AppSourceGit, 'sourceData'>;

// ------------  --------------

export const APPLICATION_ACTION_STATE = {
  SUCCESS: 'success',
  RUNNING: 'running',
  FAIL:    'fail',
  PENDING: 'pending',
};

export const APPLICATION_PARTS = {
  VALUES:   'values',
  CHART:    'chart',
  IMAGE:    'image',
  MANIFEST: 'manifest'
};

// --------------------------------------
// Temporary code until models are typed
interface EpinioMeta {
  name: string,
  namespace?: string,
  createdAt: string,
}

interface EpinioMetaProperty {
  metadata: {
    name: string,
    namespace?: string
    creationTimestamp: string,
  }
}

export interface EpinioApplicationResource {
  configuration: {
    instances: number,
    configurations: string[],
    appchart?: string,
    environment: Map<string, string>,
    routes: string[]
  },
  image_url: string
  meta: EpinioMeta
  origin: {
    Kind: number,
    archive: boolean,
    container: any,
    path: string
    git?: {
      provider: GitProvider,
      repository: string,
      branch: string,
      revision: string,
    }
  }
  stage_id: string
  staging: {
    builder: string
  }
  status: string
  statusmessage: string
}

export type EpinioApplication = EpinioApplicationResource & EpinioApplicationModel & EpinioMetaProperty;

export interface EpinioApplicationChartResource {
  meta: EpinioMeta,
  description: string,
  helm_chart: string,
  short_description: string,
}

export type EpinioAppChart = EpinioApplicationChartResource & EpinioAppChartModel & EpinioMetaProperty;

export interface EpinioHelmRepoResource {
  name: string,
  url: string,
}

export interface EpinioCatalogServiceResource {
  id: string,
  description: string,
  shortId: string,
  short_description: string,
  chart: string,
  chartVersion: string,
  appVersion: string,
  helm_repo: EpinioHelmRepoResource,
  values: string,
}

export type EpinioCatalogService = EpinioCatalogServiceResource & EpinioCatalogServiceModel & EpinioMetaProperty;

export interface EpinioConfigurationResource {
  meta: EpinioMeta
  configuration: {
    user: string,
    details: Map<string, object>,
    boundapps: string[],
  }
}

export type EpinioConfiguration = EpinioConfigurationResource & EpinioConfigurationModel & EpinioMetaProperty;

export interface EpinioServiceResource {
  meta: EpinioMeta
  boundapps: string[],
  catalog_service: string,
  catalog_service_version: string,
  status: string,
}

export type EpinioService = EpinioServiceResource & EpinioServiceModel & EpinioMetaProperty;

export interface EpinioInfo {
  default_builder_image: string,
  kube_version: string,
  platform: string,
  version: string,
}

export interface EpinioVersion {
  fullVersion: string,
  displayVersion: string,
}

export interface EpinioNamespace extends EpinioMetaProperty {
  apps: string[],
  configurations: string[],
}

export type EpinioCompRecord = Record<string, any>

export interface EpinioAppInfo {
  meta: {
    name: string,
    namespace: string
  },
  chart?: object,
  configuration: {
    configurations: string[],
    instances: number,
    environment: { [key: string] : any }
    settings: { [key: string] : any }
    routes: string[]
  }
}

export const EPINIO_APP_MANIFEST = 'manifest';

export interface EpinioAppBindings {
  configurations: string[],
  services: EpinioService[],
}

