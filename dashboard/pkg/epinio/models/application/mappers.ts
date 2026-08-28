import { ApiApp, ApiAppConfiguration, ApiAppDeployment, ApiAppOrigin, ApiAppStage, ApiAppGitRef, ApiListAppsResponse } from "./api-types";
import { App, AppConfiguration, AppDeployment, AppOrigin, AppStage, AppGitRef, ListAppsResponse } from "./ui-types";
import { statusToStateDisplay } from "../../models/resource/mappers";

function toAppStage(apiStage: ApiAppStage): AppStage {
    return {
        builder: apiStage.builder,
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
    return {
        meta: apiApp.meta,
        configuration: toAppConfiguration(apiApp.configuration),
        deployment: toAppDeployment(apiApp.deployment),
        imageUrl: apiApp.image_url,
        origin: toAppOrigin(apiApp.origin),
        stageId: apiApp.stage_id,
        staging: toAppStage(apiApp.staging),
        stagingStatus: apiApp.stagingstatus,
        status: apiApp.status,
        statusMessage: apiApp.statusmessage,
        stateDisplay: statusToStateDisplay[apiApp.status],
    };
}

export function toListAppsResponse(apiResponse: ApiListAppsResponse): ListAppsResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toApp),
        ...paginationMetadata,
    };
}
