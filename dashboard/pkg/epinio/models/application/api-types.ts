import { ApiListResourceResponse } from "../../models/resource/api-types";

export interface ApiAppMeta {
    name: string;
    namespace: string;
    createdAt: string;
}

export interface ApiAppConfiguration {
    appchart: string;
    configurations?: string[];
    bound_configurations?: {
        name: string;
        type: 'custom' | 'service';
    }[];
    environment?: Record<string, string>;
    // ignore: string[];
    instances: number;
    // replace_env: boolean;
    routes: string[];
    services?: string[];
    settings?: Record<string, string>;
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
    repository?: string;
    revision?: string;
    gitconfig?: string;
    url?: string;
}

export interface ApiAppOrigin {
    Kind?: number;
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
    deployment?: ApiAppDeployment;
    image_url: string;
    /** Image produced by the last stage; distinct from image_url (deployed). */
    built_image_url?: string;
    /** Last completed lifecycle step: create | build | deployed. */
    buildstatus?: string;
    origin: ApiAppOrigin;
    stage_id: string;
    staging: ApiAppStage;
    stagingstatus: string;
    status: 'created' | 'staging' | 'deploying' | 'running' | 'error';
    statusmessage: string;
    blobuid: string;
}

export type ApiListAppsResponse = ApiListResourceResponse<ApiApp>;

export interface ApiAppStageRequest {
    app: ApiAppMeta;
    blobuid?: string;
    builderimage?: string;
    buildmode?: string;
    dockerfilepath?: string;
    origin: ApiAppOrigin;
}

export interface ApiAppDeployRequest {
    app: ApiAppMeta;
    blobuid?: string;
    builderimage?: string;
    buildmode?: string;
    dockerfilepath?: string;
    image?: string;
    origin: ApiAppOrigin;
    stage?: {
        id: string;
    }
}

export interface ApiAppDeleteRequest {
    deleteImage?: boolean;
    deletePVC?: boolean;
    unmounted?: boolean;
}

export interface ApiAppUpdateRequest {
    appchart: string;
    configurations: string[];
    environment: Record<string, string>;
    instances: number;
    replace_env: boolean;
    restart: boolean;
    routes: string[] | null;
    settings: Record<string, string> | null;
}

export interface ApiAppCreateRequest {
    configuration: ApiAppUpdateRequest;
    name: string;
}

export interface ApiAppManifest {
    name: string;
    namespace: string;
    configuration: ApiAppConfiguration;
    origin: ApiAppOrigin;
    staging: ApiAppStage;    
}

export interface ApiAppStoreArchiveResponse {
    blobuid: string;
}

export interface ApiAppOperation {
    app: ApiAppMeta;
    error: string;
    finishedAt: string;
    id: string;
    image: string;
    kind: string;
    phase: string;
    routes: string[];
    stage_id: string;
    startedAt: string;
    status: string;
    warnings: string[];
}

export interface ApiSkippedApp {
    app: ApiAppMeta;
    reason: string;
}

export interface ApiOperationsResponse {
    boundapps?: string[];
    operations?: ApiAppOperation[];
    skipped?: ApiSkippedApp[];
    wasbound?: string[]
}

export interface ApiAppState {
    app: ApiAppMeta;
    buildstatus?: string;
    operation?: ApiAppOperation;
    stage_id?: string;
    stagingstatus?: string;
    status: string;
    statusmessage: string;
}