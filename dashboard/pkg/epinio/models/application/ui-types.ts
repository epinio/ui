import { ListResourceResponse } from "../../models/resource/ui-types";

export interface AppMeta {
    name: string;
    namespace: string;
    createdAt: string;
}

export interface AppConfiguration {
    appChart: string;
    configurations: string[];
    environment: Record<string, string>;
    // ignore: string[];
    instances: number;
    // replace_env: boolean;
    routes: string[];
    services: string[];
    settings: Record<string, string>;
}

export interface AppPodInfo {
    createdAt: string;
    memoryBytes: number;
    metricsOk: boolean;
    millicpus: number;
    name: string;
    ready: boolean;
    restarts: number;
}

export interface AppDeployment {
    active: boolean;
    createdAt: string;
    desiredReplicas: number;
    name: string;
    readyReplicas: number;
    replicas: Record<string, AppPodInfo>;
    routes: string[];
    stageId: string;
    status: string;
    username: string;
}

export interface AppGitRef {
    branch?: string;
    provider?: string;
    repository: string;
    revision: string;
    gitconfig?: string;
}

export interface AppOrigin {
    Kind: number;
    archive?: boolean;
    container?: string;
    git?: AppGitRef;
    path?: string;
}

export interface AppStage {
    builder?: string;
    buildMode?: string;
    dockerfilePath?: string;
}

export interface App {
    meta: AppMeta;
    configuration: AppConfiguration;
    deployment: AppDeployment;
    imageUrl: string;
    origin: AppOrigin;
    stageId: string;
    staging: AppStage;
    stagingStatus: string;
    status: 'created' | 'staging' | 'deploying' | 'running' | 'error';
    statusMessage: string;
    stateDisplay: string;
    blobUid: string;
    canRetryBuild: boolean;
}

export type ListAppsResponse = ListResourceResponse<App>;

export type AppExportCancelMap = Record<string, AbortController>;

export interface AppDeploymentStatus {
    app: AppMeta;
    error: string;
    finishedAt: string;
    id: string;
    image: string;
    routes: string[];
    stageId: string;
    startedAt: string;
    status: string;
    warnings: string[];
}

export interface AsyncDeployRequest {
    app: AppMeta;
    blobUid: string;
    builderImage: string;
    buildMode: string;
    dockerfilePath: string;
    image: string;
    origin: AppOrigin;
}

export interface AppStageRequest {
    app: AppMeta;
    blobUid: string;
    builderImage: string;
    buildMode: string;
    dockerfilePath: string;
    image: string;
}

export interface AppStageResponse {
    stage: {
        id: string;
    };
    image: string;
}

export interface AppDeployRequest {
    app: AppMeta;
    image: string;
    origin: AppOrigin;
    stage: {
        id: string;
    }
}

export interface AppDeployResponse {
    routes: string[];
    warnings: string[];
}