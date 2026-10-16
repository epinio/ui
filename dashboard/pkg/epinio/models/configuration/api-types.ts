import { ApiListResourceResponse } from "../resource/api-types";

interface ApiConfigurationMeta {
    name: string;
    createdAt: string;
    namespace: string;
}

export interface ApiConfiguration {
    boundapps: string[] | null;
    details?: Record<string, string>;
    origin: string;
    siblings?: string[];
    type: string;
    user: string;
}

export interface ApiConfigurationResponse {
    meta: ApiConfigurationMeta;
    configuration: ApiConfiguration;
}

export type ApiListConfigurationsResponse = ApiListResourceResponse<ApiConfigurationResponse>;

export interface ApiConfigurationCreateRequest {
    name: string;
    data: Record<string, string>;
}

export interface ApiConfigurationBindRequest {
    names: string[];
}

export interface ApiConfigurationPutRequest {
    restart?: boolean;
    data: Record<string, string>;
}
