import { ListResourceResponse } from "../resource/ui-types";

interface ServiceInstanceMeta {
    name: string;
    createdAt: string;
    namespace: string;
}

export interface ServiceInstance {
    meta: ServiceInstanceMeta;
    catalogService: string;
    catalogServiceVersion: string;
    status: string;
    stateDisplay?: string;
    boundApps: string[] | null;
    details?: Record<string, string>;
    internalRoutes?: string[];
    secretTypes?: string[];
    settings?: Record<string, string>;
}

export type ListServiceInstancesResponse = ListResourceResponse<ServiceInstance>;

export interface ServiceCreateRequest {
    name: string;
    catalogService: string;
    settings: Record<string, string>;
    wait: boolean;
}

export interface ServiceBindRequest {
    appName: string;
}

export interface ServicePutRequest {
    restart?: boolean;
    settings: Record<string, string>;
    wait: boolean;
}