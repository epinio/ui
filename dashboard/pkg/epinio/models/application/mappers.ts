import { ApiApp, ApiAppConfiguration, ApiAppDeployment, ApiAppOrigin, ApiAppStage, ApiAppGitRef, ApiListAppsResponse, ApiAppDeploymentStatus, ApiAsyncDeployRequest, ApiAppStageRequest, ApiAppStageResponse, ApiAppDeployRequest, ApiAppDeployResponse, ApiAppDeleteRequest, ApiAppUpdateRequest, ApiAppCreateRequest, ApiAppGitImportParams, ApiAppGitImportResponse, ApiAppDeploymentsRequest } from "./api-types";
import { App, AppConfiguration, AppDeployment, AppOrigin, AppStage, AppGitRef, ListAppsResponse, AppDeploymentStatus, AsyncDeployRequest, AppStageRequest, AppStageResponse, AppDeployRequest, AppDeployResponse, AppDeleteRequest, AppUpdateRequest, AppCreateRequest, AppGitImportParams, AppGitImportResponse, AppDeploymentsRequest, AppFormSource, AppFormBindings, AppFormDetails, AppFormBuildOptions, AppForm } from "./ui-types";
import { statusToStateDisplay } from "../../models/resource/mappers";
import { AppUtils } from "../../utils/application";
import { APPLICATION_SOURCE_TYPE, APPLICATION_BUILD_MODE } from "../../types";
import { parse } from "../../utils/url";

function toAppStage(apiStage: ApiAppStage): AppStage {
    return {
        builder: apiStage.builder,
        buildMode: apiStage.buildMode,
        dockerfilePath: apiStage.dockerfilePath,
    };
}

function toAppConfiguration(apiConfiguration: ApiAppConfiguration): AppConfiguration {
    return {
        appChart: apiConfiguration.appchart,
        configurations: apiConfiguration.configurations,
        boundConfigurations: apiConfiguration.bound_configurations,
        environment: apiConfiguration.environment,
        instances: apiConfiguration.instances,
        routes: apiConfiguration.routes,
        services: apiConfiguration.services,
        settings: apiConfiguration.settings,
    };
}

function toAppDeployment(apiDeployment: ApiAppDeployment): AppDeployment {
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
    return {
        Kind: apiOrigin.Kind,
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
        repository: apiGitRef.repository,
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

export function toAppDeploymentStatus(apiDeploymentStatus: ApiAppDeploymentStatus): AppDeploymentStatus {
    return {
        app: apiDeploymentStatus.app,
        error: apiDeploymentStatus.error,
        finishedAt: apiDeploymentStatus.finishedAt,
        id: apiDeploymentStatus.id,
        image: apiDeploymentStatus.image,
        routes: apiDeploymentStatus.routes,
        stageId: apiDeploymentStatus.stage_id,
        startedAt: apiDeploymentStatus.startedAt,
        status: apiDeploymentStatus.status,
        warnings: apiDeploymentStatus.warnings,
    };
}

export function toApiAsyncDeployRequest(app: AsyncDeployRequest ): ApiAsyncDeployRequest {
    return {
        app: app.app,
        blobuid: app.blobUid,
        builderimage: app.builderImage,
        buildmode: app.buildMode,
        dockerfilepath: app.dockerfilePath,
        image: app.image,
        origin: toApiAppOrigin(app.origin),
    };
}

export function toApiAppStageRequest(app: AppStageRequest): ApiAppStageRequest {
    return {
        app: app.app,
        blobuid: app.blobUid,
        builderimage: app.builderImage,
        buildmode: app.buildMode,
        dockerfilepath: app.dockerfilePath,
        image: app.image,
    };
}

export function toAppStageResponse(apiResponse: ApiAppStageResponse): AppStageResponse {
    return {
        stage: apiResponse.stage,
        image: apiResponse.image,
    };
}

export function toApiAppDeployRequest(app: AppDeployRequest): ApiAppDeployRequest {
    return {
        app: app.app,
        image: app.image,
        origin: toApiAppOrigin(app.origin),
        stage: {
            id: app.stage.id,
        }
    };
}

export function toAppDeployResponse(apiResponse: ApiAppDeployResponse): AppDeployResponse {
    return {
        routes: apiResponse.routes,
        warnings: apiResponse.warnings,
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

export function toApiAppDeploymentsRequest(app: AppDeploymentsRequest): ApiAppDeploymentsRequest {
    return {
        app: app.app,
        blobuid: app.blobUid,
        builderimage: app.builderImage,
        buildmode: app.buildMode,
        dockerfilepath: app.dockerfilePath,
        image: app.image,
        origin: toApiAppOrigin(app.origin),
    };
}

export function toApiAppGitImportParams(params: AppGitImportParams): ApiAppGitImportParams {
    return {
        giturl: params.gitUrl,
        gitrev: params.gitRev,
    };
}

export function toAppGitImportResponse(response: ApiAppGitImportResponse): AppGitImportResponse {
    return {
        blobUid: response.blobuid,
        branch: response.branch,
        revision: response.revision,
    };
}

// FORM MAPPERs
function toAppFormGitData(gitData: AppGitRef): AppFormSource['github' | 'gitlab'] {
    const url = gitData.repository;
    const parsed = parse(url);

    const parts = parsed.path.split('/');
    return {
        userOrOrg: parts[1],
        branch: gitData.branch || '',
        commit: gitData.revision,
        repository: parts[2],
        gitConfig: gitData.gitconfig,
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
                github: origin.git ? toAppFormGitData(origin.git) : { userOrOrg: '', branch: '', commit: '', repository: '', gitConfig: '' },
            };
        case APPLICATION_SOURCE_TYPE.GIT_LAB:
            return {
                type: APPLICATION_SOURCE_TYPE.GIT_LAB,
                gitlab: origin.git ? toAppFormGitData(origin.git) : { userOrOrg: '', branch: '', commit: '', repository: '', gitConfig: '' },
            };
        default:
            throw new Error(`Unsupported source type: ${sourceType}`);
    }
}

export function toAppFormBuildOptions(app: App): AppFormBuildOptions {
    return {
        appChart: app.configuration.appChart || '',
        buildMode: app.staging.buildMode || APPLICATION_BUILD_MODE.BUILDPACK,
        builderImage: app.staging.builder || '',
        dockerfilePath: app.staging.dockerfilePath || '',
        builderImagesForbidden: false,
    };
}

export function toAppFormDetails(app: App): AppFormDetails {
    return {
        name: app.meta.name,
        namespace: app.meta.namespace,
        instances: app.configuration.instances,
        routes: [...app.configuration.routes],
        settings: {...app.configuration.settings},
        environment: Object.entries(app.configuration.environment).map(([key, value]) => ({ key, value })),
    }
}

export function toAppFormBindings(app: App): AppFormBindings {
    return {
        services: [...app.configuration.services],
        configurations: app.configuration.boundConfigurations.filter(c => c.type === 'custom').map(c => c.name),
        serviceConfigurations: app.configuration.boundConfigurations.filter(c => c.type === 'service').map(c => c.name),
    };
}

export function toAppForm(app: App): AppForm {
    return {
        source: toAppFormSource(app.origin),
        buildOptions: toAppFormBuildOptions(app),
        details: toAppFormDetails(app),
        bindings: toAppFormBindings(app),
    };
}
