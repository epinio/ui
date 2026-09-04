import { ApiApp, ApiAppConfiguration, ApiAppDeployment, ApiAppOrigin, ApiAppStage, ApiAppGitRef, ApiListAppsResponse, ApiAppDeploymentStatus, ApiAsyncDeployRequest, ApiAppStageRequest, ApiAppStageResponse, ApiAppDeployRequest, ApiAppDeployResponse } from "./api-types";
import { App, AppConfiguration, AppDeployment, AppOrigin, AppStage, AppGitRef, ListAppsResponse, AppDeploymentStatus, AsyncDeployRequest, AppStageRequest, AppStageResponse, AppDeployRequest, AppDeployResponse } from "./ui-types";
import { statusToStateDisplay } from "../../models/resource/mappers";
import { AppUtils } from "../../utils/application";
import { APPLICATION_SOURCE_TYPE } from "../../types";

function toAppStage(apiStage: ApiAppStage): AppStage {
    return {
        builder: apiStage.builder,
        buildMode: apiStage.buildMode,
        dockerfilePath: apiStage.dockerfilePath,
    };
}

function toAppConfiguration(apiConfiguration: ApiAppConfiguration): AppConfiguration {
    return {
        appChart: apiConfiguration.appChart,
        configurations: apiConfiguration.configurations,
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