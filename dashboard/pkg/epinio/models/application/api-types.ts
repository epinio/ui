import { ApiListResourceResponse } from "../../models/resource/api-types";

export interface ApiAppMeta {
    name: string;
    namespace: string;
    createdAt: string;
}

export interface ApiAppConfiguration {
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

export interface ApiAppPodInfo {
    createdAt: string;
    memoryBytes: number;
    metricsOk: boolean;
    millicpus: number;
    name: string;
    ready: boolean;
    restarts: number;
}

export interface ApiAppDeployment {
    active: boolean;
    createdAt: string;
    desiredreplicas: number;
    name: string;
    readyreplicas: number;
    replicas: Record<string, ApiAppPodInfo>;
    routes: string[];
    stage_id: string;
    status: string;
    username: string;
}

export interface ApiAppGitRef {
    branch?: string;
    provider?: string;
    repository: string;
    revision: string;
    gitconfig?: string;
    url?: string;
}

export interface ApiAppOrigin {
    Kind: number;
    archive?: boolean;
    container?: string;
    git?: ApiAppGitRef;
    path?: string;
}

export interface ApiAppStage {
    builder?: string;
    buildMode?: string;
    dockerfilePath?: string;
}

export interface ApiApp {
    meta: ApiAppMeta;
    configuration: ApiAppConfiguration;
    deployment: ApiAppDeployment;
    image_url: string;
    origin: ApiAppOrigin;
    stage_id: string;
    staging: ApiAppStage;
    stagingstatus: string;
    status: 'created' | 'staging' | 'deploying' | 'running' | 'error';
    statusmessage: string;
    blobuid: string;
}

export type ApiListAppsResponse = ApiListResourceResponse<ApiApp>;

export interface ApiAppDeploymentStatus {
    app: ApiAppMeta;
    error: string;
    finishedAt: string;
    id: string;
    image: string;
    routes: string[];
    stage_id: string;
    startedAt: string;
    status: string;
    warnings: string[];
}

export interface ApiAsyncDeployRequest {
    app: ApiAppMeta;
    blobuid: string;
    builderimage: string;
    buildmode: string;
    dockerfilepath: string;
    image: string;
    origin: ApiAppOrigin;
}

export interface ApiAppStageRequest {
    app: ApiAppMeta;
    blobuid: string;
    builderimage: string;
    buildmode: string;
    dockerfilepath: string;
    image: string;
}

export interface ApiAppStageResponse {
    stage: {
        id: string;
    };
    image: string;
}

export interface ApiAppDeployRequest {
    app: ApiAppMeta;
    image: string;
    origin: ApiAppOrigin;
    stage: {
        id: string;
    }
}

export interface ApiAppDeployResponse {
    routes: string[];
    warnings: string[];
}