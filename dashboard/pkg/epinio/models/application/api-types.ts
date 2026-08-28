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
}

export interface ApiAppOrigin {
    Kind: number;
    archive?: boolean;
    container?: string;
    git?: ApiAppGitRef;
    path?: string;
}

export interface ApiAppStage {
    builder: string;
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
    status: string;
    statusmessage: string;
}

export type ApiListAppsResponse = ApiListResourceResponse<ApiApp>;