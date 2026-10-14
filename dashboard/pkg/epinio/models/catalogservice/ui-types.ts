import { ListResourceResponse } from "../resource/ui-types";

interface CatalogServiceMeta {
    name: string;
    createdAt: string;
}

interface CatalogServiceHelmRepo {
    name: string;
    url: string;
    secret?: string;
}

export interface ChartSetting {
    name: string;
    type: 'string' | 'bool' | 'number' | 'integer';
    enum?: string[];
    maximum?: number;
    minimum?: number;
    value?: any;
}

export interface CatalogService {
    meta: CatalogServiceMeta;
    appVersion?: string;
    boundServices?: boolean;
    chart: string;
    chartVersion?: string;
    description: string;
    helmRepo: CatalogServiceHelmRepo;
    serviceIcon?: string;
    shortDescription: string;
    values?: string;
    secretTypes?: string[];
    settings?: ChartSetting[];
}

export type ListCatalogServicesResponse = ListResourceResponse<CatalogService>;

export interface CatalogServiceCreateRequest {
    name: string;
    description: string;
    shortDescription: string;
    chart: string;
    chartVersion?: string;
    appVersion?: string;
    serviceIcon?: string;
    helmRepo: CatalogServiceHelmRepo;
    settings?: ChartSetting[];
    secretTypes?: string[];
    values?: string;
}

export type CatalogServiceUpdateRequest = Partial<CatalogServiceCreateRequest>;