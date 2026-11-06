import { ApiApp, ApiAppConfiguration, ApiAppDeployment, ApiAppOrigin, ApiAppStage, ApiAppGitRef, ApiListAppsResponse, ApiAppStageRequest, ApiAppDeployRequest, ApiAppDeleteRequest, ApiAppUpdateRequest, ApiAppCreateRequest, ApiAppManifest, ApiAppStoreArchiveResponse, ApiOperationsResponse, ApiAppOperation, ApiSkippedApp, ApiAppState } from "./api-types";
import { App, AppConfiguration, AppDeployment, AppOrigin, AppStage, AppGitRef, ListAppsResponse, AppStageRequest, AppDeployRequest, AppDeleteRequest, AppUpdateRequest, AppCreateRequest, AppFormSource, AppFormBindings, AppFormDetails, AppFormBuildOptions, AppForm, AppManifest, AppStoreArchiveResponse, AppMeta, AppPodInfo, OperationsResponse, AppOperation, SkippedApp, AppState } from "./ui-types";
import { statusToStateDisplay } from "../../models/resource/mappers";
import { AppUtils } from "../../utils/application";
import { APPLICATION_SOURCE_TYPE, APPLICATION_BUILD_MODE, APPLICATION_MANIFEST_SOURCE_TYPE } from "../../types";
import { parse } from "../../utils/url";
import { identity, pickBy } from "lodash";

function toAppStage(apiStage: ApiAppStage): AppStage {
    return {
        builder: apiStage.builder,
        buildMode: apiStage.buildMode,
        dockerfilePath: apiStage.dockerfilePath,
    };
}

function toAppConfiguration(apiConfiguration: ApiAppConfiguration, fromManifest?: boolean): AppConfiguration {
    return {
        appChart: apiConfiguration.appchart,
        configurations: apiConfiguration.configurations,
        boundConfigurations: apiConfiguration.bound_configurations,
        environment: apiConfiguration.environment,
        instances: apiConfiguration.instances,
        routes: fromManifest ? [] : apiConfiguration.routes,
        services: apiConfiguration.services,
        settings: apiConfiguration.settings,
    };
}

function toAppDeployment(apiDeployment: ApiAppDeployment | undefined): AppDeployment | undefined {
    if (!apiDeployment) return undefined;
    return {
        active: apiDeployment.active,
        createdAt: apiDeployment.createdAt,
        desiredReplicas: apiDeployment.desiredreplicas,
        name: apiDeployment.name,
        readyReplicas: apiDeployment.readyreplicas,
        replicas: apiDeployment.replicas,
        routes: apiDeployment.routes,
        stageId: apiDeployment.stage_id,
        status: apiDeployment.status,
        username: apiDeployment.username,
    };
}

function toAppOrigin(apiOrigin: ApiAppOrigin): AppOrigin {
    let Kind = apiOrigin.Kind;
    // Determine the kind of the app origin if it's not explicitly set (for example from manifest)
    if (!Kind) {
        if (apiOrigin.archive || apiOrigin.path) Kind = APPLICATION_MANIFEST_SOURCE_TYPE.PATH;
        if (apiOrigin.container) Kind = APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER;
        if (apiOrigin.git) Kind = APPLICATION_MANIFEST_SOURCE_TYPE.GIT;
        else Kind = APPLICATION_MANIFEST_SOURCE_TYPE.NONE;
    }
    return {
        Kind: Kind,
        archive: apiOrigin.archive,
        container: apiOrigin.container,
        git: apiOrigin.git ? toAppGitRef(apiOrigin.git) : undefined,
        path: apiOrigin.path,
    };
}

function toApiAppGitRef(gitRef: AppGitRef): ApiAppGitRef {
    return {
        branch: gitRef.branch,
        provider: gitRef.provider,
        repository: gitRef.repository,
        revision: gitRef.revision,
        gitconfig: gitRef.gitconfig,
    };
}

function toApiAppOrigin(origin: AppOrigin): ApiAppOrigin {
    return {
        Kind: origin.Kind,
        archive: origin.archive,
        container: origin.container,
        git: origin.git ? toApiAppGitRef(origin.git) : undefined,
        path: origin.path,
    };
}

function toAppGitRef(apiGitRef: ApiAppGitRef): AppGitRef {
    return {
        branch: apiGitRef.branch,
        provider: apiGitRef.provider,
        repository: apiGitRef.repository ?? apiGitRef.url,
        revision: apiGitRef.revision,
        gitconfig: apiGitRef.gitconfig,
    };
}

export function toApp(apiApp: ApiApp): App {
    const origin = toAppOrigin(apiApp.origin);
    const sourceType = AppUtils.getSourceType(origin);
    const hasGit = !!(apiApp.origin?.git?.repository || apiApp.origin?.git?.url);
    const hasBlob = !!apiApp.blobuid;
    
    return {
        meta: apiApp.meta,
        configuration: toAppConfiguration(apiApp.configuration),
        deployment: toAppDeployment(apiApp.deployment),
        imageUrl: apiApp.image_url,
        origin: origin,
        stageId: apiApp.stage_id,
        staging: toAppStage(apiApp.staging),
        stagingStatus: apiApp.stagingstatus,
        status: apiApp.status,
        statusMessage: apiApp.statusmessage,
        stateDisplay: statusToStateDisplay[apiApp.status],
        blobUid: apiApp.blobuid,
        canRetryBuild: sourceType === APPLICATION_SOURCE_TYPE.CONTAINER_URL ? false : hasGit || hasBlob,
    };
}

export function toListAppsResponse(apiResponse: ApiListAppsResponse): ListAppsResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toApp),
        ...paginationMetadata,
    };
}

export function toApiAppStageRequest(app: AppStageRequest): ApiAppStageRequest {
    return {
        app: app.app,
        blobuid: app.blobUid,
        builderimage: app.builderImage,
        buildmode: app.buildMode,
        dockerfilepath: app.dockerfilePath,
        origin: toApiAppOrigin(app.origin),
    };
}

export function toApiAppDeployRequest(app: AppDeployRequest): ApiAppDeployRequest {
    return {
        app: app.app,
        blobuid: app.blobUid,
        builderimage: app.builderImage,
        buildmode: app.buildMode,
        dockerfilepath: app.dockerfilePath,
        image: app.image,
        origin: toApiAppOrigin(app.origin),
        stage: app.stage
    };
}

export function toApiAppDeleteRequest(app: AppDeleteRequest): ApiAppDeleteRequest {
    return {
        deleteImage: !!app.deleteImage,
        deletePVC: !!app.deletePVC,
        unmounted: !!app.unmounted,
    };
};

export function toApiAppUpdateRequest(app: AppUpdateRequest): ApiAppUpdateRequest {
    return {
        appchart: app.appChart,
        configurations: app.configurations,
        environment: app.environment,
        instances: app.instances,
        replace_env: app.replaceEnv,
        restart: app.restart,
        routes: app.routes,
        settings: app.settings,
    };
}

export function toApiAppCreateRequest(app: AppCreateRequest): ApiAppCreateRequest {
    return {
        configuration: toApiAppUpdateRequest(app.configuration),
        name: app.name,
    };
}

export function toAppManifest(apiManifest: ApiAppManifest): AppManifest {
    return {
        meta: {
            name: '',
            namespace: apiManifest.namespace,
            createdAt: '',
        },
        configuration: toAppConfiguration(apiManifest.configuration, true),
        origin: toAppOrigin(apiManifest.origin),
        staging: toAppStage(apiManifest.staging),
    };
}

export function toAppStoreArchiveResponse(apiResponse: ApiAppStoreArchiveResponse): AppStoreArchiveResponse {
    return {
        blobUid: apiResponse.blobuid,
    };
}

export function toInstanceStats(instances: AppPodInfo[], prop: 'millicpus' | 'memoryBytes') {
    const stats = instances.reduce((res, r) => {
      if (r[prop] >= res.max) {
        res.max = r[prop];
      }
      if (r[prop] <= res.min) {
        res.min = r[prop];
      }
      res.total += r[prop];

      return res;
    }, {
      min: instances[0]?.[prop] || 0, max: 0, total: 0
    });

    const avg = instances.length ? (stats.total / instances.length).toFixed(2) : 0;

    return {
      ...stats,
      avg: avg === '0.00' ? 0 : avg,
    };
}

export function toAppSourceDetails(application: AppForm, t: any) {
    console.log(application);
  const appChart = {
    label: 'App Chart',
    value: application.buildOptions.appChart
  };

  const builder = {
    label: '',
    value: ''
  };
  if (application.buildOptions.buildMode === 'dockerfile') {
    builder.label = 'Dockerfile Path';
    builder.value = application.buildOptions.dockerfilePath ?? '';
  } else {
    builder.label = 'Builder Image';
    builder.value = application.buildOptions.builderImage ?? '';
  }

  const sourceType = application.source.type;

  switch (sourceType) {
    case APPLICATION_SOURCE_TYPE.FOLDER:
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
      return {
        label:   'File system',
        icon:    'icon-file',
        details: [
          {
            label: 'Original Name',
            value: application.source[sourceType]?.name
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
            value: application.source.gitUrl?.url
          }, {
            label: 'Revision',
            icon:  'icon-commit',
            value: application.source.gitUrl?.branch
          }, appChart, builder
        ]
      };
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      return {
        label:   t(`epinio.applications.gitSource.${ sourceType }.label`),
        icon:    `icon-${ sourceType }`,
        details: [
          {
            label: 'Url',
            value: application.source.github?.url
          }, {
            label: 'Revision',
            icon:  'icon-commit',
            value: application.source.github?.commit
          }, {
            label: 'Branch',
            icon:  'icon-commit',
            value: application.source.github?.branch
          }, appChart, builder
        ]
      };
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      return {
        label:   'Container',
        icon:    'icon-docker',
        details: [{
          label: 'Image',
          value: application.source.containerUrl?.url
        }, appChart
        ]
      };
    default:
      return undefined;
    }
}

export function toAppOperation(apiOperation: ApiAppOperation): AppOperation {
    return {
        app: apiOperation.app,
        error: apiOperation.error,
        finishedAt: apiOperation.finishedAt,
        id: apiOperation.id,
        image: apiOperation.image,
        kind: apiOperation.kind,
        phase: apiOperation.phase,
        routes: apiOperation.routes,
        stageId: apiOperation.stage_id,
        startedAt: apiOperation.startedAt,
        status: apiOperation.status,
        warnings: apiOperation.warnings,
    };
}

export function toSkippedApp(apiSkippedApp: ApiSkippedApp): SkippedApp {
    return {
        app: apiSkippedApp.app,
        reason: apiSkippedApp.reason,
    };
}

export function toOperationsResponse(apiResponse: ApiOperationsResponse): OperationsResponse {
    return {
        boundApps: apiResponse.boundapps,
        operations: (apiResponse.operations || []).map(toAppOperation),
        skipped: (apiResponse.skipped || []).map(toSkippedApp),
        wasBound: apiResponse.wasbound,
    };
}

export function toAppState(apiState: ApiAppState): AppState {
    return {
        app: apiState.app,
        buildStatus: apiState.buildstatus,
        operation: apiState.operation ? toAppOperation(apiState.operation) : undefined,
        stageId: apiState.stage_id,
        stagingStatus: apiState.stagingstatus,
        status: apiState.status,
        statusMessage: apiState.statusmessage,
    };
}

export function appToAppDeployRequest(app: App, restaging?: boolean): AppDeployRequest {
    const appDeployRequest: AppDeployRequest = {
        app: app.meta,
        blobUid: app.blobUid,
        builderImage: app.staging.builder,
        buildMode: app.staging.buildMode,
        dockerfilePath: app.staging.dockerfilePath,
        image: app.imageUrl,
        origin: app.origin,
        stage: {
            id: app.stageId
        }
    };

    if (restaging) {
        delete appDeployRequest.image;
        delete appDeployRequest.stage;
    }

    return appDeployRequest;
}


// FORM MAPPERs
function toAppFormGitData(gitData: AppGitRef): AppFormSource['github' | 'gitlab'] {
    const url = gitData.repository;
    const parsed = parse(url || '');

    const parts = parsed.path.split('/');
    return {
        userOrOrg: parts[1],
        branch: gitData.branch || '',
        commit: gitData.revision || '',
        repository: parts[2],
        gitConfig: gitData.gitconfig,
        url: url || '',
    };
}

export function toAppFormSource(origin: AppOrigin): AppFormSource {
    const sourceType = AppUtils.getSourceType(origin);
    switch (sourceType) {
        case APPLICATION_SOURCE_TYPE.ARCHIVE:
            return {
                type: APPLICATION_SOURCE_TYPE.ARCHIVE,
                archive: {
                    name: origin.path || '',
                },
            };
        case APPLICATION_SOURCE_TYPE.FOLDER:
            return {
                type: APPLICATION_SOURCE_TYPE.FOLDER,
                folder: {
                    name: origin.path || '',
                },
            };
        case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
            return {
                type: APPLICATION_SOURCE_TYPE.CONTAINER_URL,
                containerUrl: {
                    url: origin.container || '',
                },
            };
        case APPLICATION_SOURCE_TYPE.GIT_URL:
            return {
                type: APPLICATION_SOURCE_TYPE.GIT_URL,
                gitUrl: {
                    gitConfig: origin.git?.gitconfig || '',
                    url: origin.git?.repository || '',
                    branch: origin.git?.revision || '',
                }
            };
        case APPLICATION_SOURCE_TYPE.GIT_HUB:
            return {
                type: APPLICATION_SOURCE_TYPE.GIT_HUB,
                github: origin.git ? toAppFormGitData(origin.git) : { userOrOrg: '', branch: '', commit: '', repository: '', gitConfig: '', url: '' },
            };
        case APPLICATION_SOURCE_TYPE.GIT_LAB:
            return {
                type: APPLICATION_SOURCE_TYPE.GIT_LAB,
                gitlab: origin.git ? toAppFormGitData(origin.git) : { userOrOrg: '', branch: '', commit: '', repository: '', gitConfig: '', url: '' },
            };
        default:
            throw new Error(`Unsupported source type: ${sourceType}`);
    }
}

export function toAppFormBuildOptions(app: App | AppManifest): AppFormBuildOptions {
    return {
        appChart: app.configuration.appChart || '',
        buildMode: app.staging.buildMode || APPLICATION_BUILD_MODE.BUILDPACK,
        builderImage: app.staging.builder || '',
        dockerfilePath: app.staging.dockerfilePath || '',
        builderImagesForbidden: false,
        deploy: true,
    };
}

export function toAppFormDetails(app: App | AppManifest): AppFormDetails {
    return {
        name: app.meta.name,
        namespace: app.meta.namespace,
        instances: app.configuration.instances,
        routes: [...(app.configuration.routes || [])],
        settings: {...(app.configuration.settings || {})},
        environment: [...Object.entries(app.configuration.environment || {}).map(([key, value]) => ({ key, value }))],
    }
}

export function toAppFormBindings(app: App | AppManifest): AppFormBindings {
    return {
        services: [...(app.configuration.services || [])],
        configurations: (app.configuration.boundConfigurations || []).filter(c => c.type === 'custom').map(c => c.name),
        serviceConfigurations: (app.configuration.boundConfigurations || []).filter(c => c.type === 'service').map(c => c.name),
    };
}

export function toAppForm(app: App | AppManifest): AppForm {
    return {
        source: toAppFormSource(app.origin),
        buildOptions: toAppFormBuildOptions(app),
        details: toAppFormDetails(app),
        bindings: toAppFormBindings(app),
    };
}

export function appFormToCreateRequest(form: AppForm): AppCreateRequest {
    return {
        configuration: appFormToUpdateRequest(form, true, false),
        name: form.details.name,
    };
}

export function appFormToUpdateRequest(form: AppForm, isCreate?: boolean, canRestart?: boolean): AppUpdateRequest {
    return {
        appChart: form.buildOptions.appChart ?? '',
        configurations: [...form.bindings.configurations, ...form.bindings.serviceConfigurations],
        environment: form.details.environment.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {}),
        instances: form.details.instances,
        replaceEnv: !isCreate,
        restart: !!canRestart,
        routes: form.details.routes.length > 0 ? form.details.routes : null,
        settings: pickBy(form.details.settings, identity) || null,
    };
}

function appFormToAppMeta(form: AppForm, createdAt?: string): AppMeta {
    return {
        name: form.details.name,
        namespace: form.details.namespace,
        createdAt: createdAt || ''
    };
}

function appFormToAppOrigin(form: AppForm): AppOrigin {
    switch (form.source.type) {
        case APPLICATION_SOURCE_TYPE.ARCHIVE:
            return {
                Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
                archive: true,
                path: form.source.archive?.name,
            };
        case APPLICATION_SOURCE_TYPE.FOLDER:
            return {
                Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
                path: form.source.folder?.name,
            };
        case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
            return {
                Kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER,
                container: form.source.containerUrl?.url,
            };
        case APPLICATION_SOURCE_TYPE.GIT_URL:
            return {
                Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
                git: {
                    revision: form.source.gitUrl?.branch,
                    repository: form.source.gitUrl?.url,
                    gitconfig: form.source.gitUrl?.gitConfig,
                },
            };
        case APPLICATION_SOURCE_TYPE.GIT_HUB:
        case APPLICATION_SOURCE_TYPE.GIT_LAB:
            return {
                Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
                git: {
                    revision: form.source[form.source.type]?.commit,
                    repository: form.source[form.source.type]?.url,
                    branch: form.source[form.source.type]?.branch,
                    provider: form.source.type,
                    gitconfig: form.source[form.source.type]?.gitConfig,
                },
            };
        default:
            throw new Error(`Unsupported application source type: ${form.source.type}`);
    }
}

export function resolveGitParams(source: AppFormSource): { url?: string; rev?: string; gitConfig?: string } {
  switch(source.type) {
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      return {
        url: source.gitUrl?.url,
        rev: source.gitUrl?.branch,
        gitConfig: source.gitUrl?.gitConfig,
      };
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB: {
      const gitSource = source[source.type];
      return {
        url: gitSource?.url,
        rev: gitSource?.commit,
        gitConfig: gitSource?.gitConfig,
      };
    }
    default:
      return {};
  }
};

export function appFormToAppStageRequest(form: AppForm, opts?: {blobUid?: string; createdAt?: string}): AppStageRequest {
    const isContainer = form.source.type === APPLICATION_SOURCE_TYPE.CONTAINER_URL;
    const isGitSource = form.source.type === APPLICATION_SOURCE_TYPE.GIT_URL || form.source.type === APPLICATION_SOURCE_TYPE.GIT_HUB || form.source.type === APPLICATION_SOURCE_TYPE.GIT_LAB;
    return {
        app: appFormToAppMeta(form, opts?.createdAt),
        blobUid: isContainer || isGitSource ? undefined : opts?.blobUid,
        builderImage: isContainer ? undefined : form.buildOptions.builderImage,
        origin: appFormToAppOrigin(form),
        buildMode: isContainer ? undefined : form.buildOptions.buildMode,
        dockerfilePath: isContainer ? undefined : form.buildOptions.dockerfilePath,
    };
}

export function appFormToAppDeployRequest(form: AppForm, opts?: {blobUid?: string; createdAt?: string; stageId?: string}): AppDeployRequest {
    const isContainer = form.source.type === APPLICATION_SOURCE_TYPE.CONTAINER_URL;
    const isGitSource = form.source.type === APPLICATION_SOURCE_TYPE.GIT_URL || form.source.type === APPLICATION_SOURCE_TYPE.GIT_HUB || form.source.type === APPLICATION_SOURCE_TYPE.GIT_LAB;

    const appDeployRequest: AppDeployRequest = {
        app: appFormToAppMeta(form, opts?.createdAt),
        blobUid: isContainer || isGitSource ? undefined : opts?.blobUid,
        builderImage: isContainer ? undefined : form.buildOptions.builderImage,
        origin: appFormToAppOrigin(form),
        buildMode: isContainer ? undefined : form.buildOptions.buildMode,
        dockerfilePath: isContainer ? undefined : form.buildOptions.dockerfilePath,
        image: isContainer ? form.source.containerUrl?.url : undefined,
    };

    if (opts?.stageId) {
        appDeployRequest.stage = { id: opts.stageId };
    }

    return appDeployRequest
}   
    

