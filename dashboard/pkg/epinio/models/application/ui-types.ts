import { ListResourceResponse } from "../../models/resource/ui-types";

export interface AppMeta {
    name: string;
    namespace: string;
    createdAt: string;
}

export interface AppConfiguration {
    appChart: string;
    configurations?: string[];
    boundConfigurations?: {
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
    repository?: string;
    revision?: string;
    gitconfig?: string;
}

export interface AppOrigin {
    Kind?: number;
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
    deployment?: AppDeployment;
    /** Currently deployed image (spec.imageurl). */
    imageUrl: string;
    /** Image from the last successful stage (spec.builtimageurl). */
    builtImageUrl?: string;
    /** create | build | deployed */
    buildStatus?: string;
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

/** Which applications list endpoint to query. Default is deployed. */
export type AppListMode = 'deployed' | 'undeployed';

export type AppExportCancelMap = Record<string, AbortController>;

export interface AppStageRequest {
    app: AppMeta;
    blobUid?: string;
    builderImage?: string;
    buildMode?: string;
    dockerfilePath?: string;
    origin: AppOrigin;
}

export interface AppDeployRequest {
    app: AppMeta;
    blobUid?: string;
    builderImage?: string;
    buildMode?: string;
    dockerfilePath?: string;
    image?: string;
    origin: AppOrigin;
    stage?: {
        id: string;
    }
}


export interface AppDeleteRequest {
    deleteImage?: boolean;
    deletePVC?: boolean;
    unmounted?: boolean;
}

export interface AppUpdateRequest {
    appChart: string;
    configurations: string[];
    environment: Record<string, string>;
    instances: number;
    replaceEnv: boolean;
    restart: boolean;
    routes: string[] | null;
    settings: Record<string, string> | null;
}

export interface AppCreateRequest {
    configuration: AppUpdateRequest;
    name: string;
}

export interface AppManifest {
    meta: AppMeta;
    configuration: AppConfiguration;
    origin: AppOrigin;
    staging: AppStage;    
}

export interface AppStoreArchiveResponse {
    blobUid: string;
}

export interface AppOperation {
    app: AppMeta;
    error: string;
    finishedAt: string;
    id: string;
    image: string;
    kind: string;
    phase: string;
    routes: string[];
    stageId: string;
    startedAt: string;
    status: string;
    warnings: string[];
}

export interface SkippedApp {
    app: AppMeta;
    reason: string;
}

export interface OperationsResponse {
    boundApps?: string[];
    operations?: AppOperation[];
    skipped?: SkippedApp[];
    wasBound?: string[]
}

export interface AppState {
    app: AppMeta;
    buildStatus?: string;
    operation?: AppOperation;
    stageId?: string;
    stagingStatus?: string;
    status: string;
    statusMessage: string;
}

// FORM ///////////////////////////////////////////////////////////////////////////
export type AppFormSourceType = 'containerUrl' | 'archive' | 'folder' | 'gitUrl' | 'github' | 'gitlab';
export interface AppFormSource {
    type: AppFormSourceType;
    containerUrl?:{
        url: string;
    },
    archive?: {
        tarball?: Blob;
        name: string;
    },
    folder?: {
        tarball?: Blob;
        name: string;
    },
    gitUrl?: {
        gitConfig?: string;
        url: string;
        branch: string;
    },
    github?: {
        gitConfig?: string;
        userOrOrg: string;
        repository: string;
        branch: string;
        commit: string;
        url: string;
    },
    gitlab?: {
        gitConfig?: string;
        userOrOrg: string;
        repository: string;
        branch: string;
        commit: string;
        url: string;
    },
}

export interface AppFormBuildOptions {
    appChart?: string;
    buildMode?: string;
    dockerfilePath?: string;
    builderImage?: string;
    builderImagesForbidden?: boolean;
    /** When true, pipeline stages only and skips deploy (CLI `app build`). */
    buildOnly?: boolean;
}

export interface AppFormDetails {
    namespace: string;
    name: string;
    instances: number;
    routes: string[];
    settings: Record<string, string>;
    environment: { key: string; value: string }[];
}

export interface AppFormBindings {
    services: string[];
    configurations: string[];
    serviceConfigurations: string[];
}

export interface AppForm {
    source: AppFormSource;
    buildOptions: AppFormBuildOptions;
    details: AppFormDetails;
    bindings: AppFormBindings;
}