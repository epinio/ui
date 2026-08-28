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
    builder: string;
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
    status: string;
    statusMessage: string;
    stateDisplay: string;
}

export type ListAppsResponse = ListResourceResponse<App>;