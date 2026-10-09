import { ApiListResourceResponse } from "../resource/api-types";

interface ApiCatalogServiceMeta {
    name: string;
    createdAt: string;
}

interface ApiCatalogServiceHelmRepo {
    name: string;
    url: string;
    secret?: string;
}

export interface ApiChartSetting {
    type: 'string' | 'bool' | 'number' | 'integer';
    enum?: string[];
    maximum?: number;
    minimum?: number;
}

export interface ApiCatalogService {
    meta: ApiCatalogServiceMeta;
    app_version?: string;
    bound_services?: boolean;
    chart: string;
    chart_version?: string;
    description: string;
    helm_repo: ApiCatalogServiceHelmRepo;
    service_icon?: string;
    short_description: string;
    values?: string;
    secret_types?: string[];
    settings?: Record<string, ApiChartSetting>;
}

export type ApiListCatalogServicesResponse = ApiListResourceResponse<ApiCatalogService>;

export interface ApiCatalogServiceCreateRequest {
    name: string;
    description: string;
    short_description: string;
    chart: string;
    chart_version?: string;
    app_version?: string;
    service_icon?: string;
    helm_repo: ApiCatalogServiceHelmRepo;
    settings?: Record<string, ApiChartSetting>;
    secret_types?: string[];
    values?: string;
}

export type ApiCatalogServiceUpdateRequest = Partial<ApiCatalogServiceCreateRequest>;