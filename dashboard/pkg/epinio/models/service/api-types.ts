import { ApiListResourceResponse } from "../resource/api-types";

interface ApiServiceInstanceMeta {
    name: string;
    createdAt: string;
    namespace: string;
}

export interface ApiServiceInstance {
    meta: ApiServiceInstanceMeta;
    catalog_service: string;
    catalog_service_version: string;
    status: string;
    boundapps: string[] | null;
    details?: Record<string, string>;
    internal_routes?: string[];
    secretTypes?: string[];
    settings?: Record<string, string>;
}

export type ApiListServiceInstancesResponse = ApiListResourceResponse<ApiServiceInstance>;

export interface ApiServiceCreateRequest {
    name: string;
    catalog_service: string;
    settings: Record<string, string>;
    wait: boolean;
}

export interface ApiServiceBindRequest {
    app_name: string;
}

export interface ApiServicePutRequest {
    restart?: boolean;
    settings: Record<string, string>;
    wait: boolean;
}
