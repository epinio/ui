import { ListResourceResponse } from "../resource/ui-types";

interface ConfigurationMeta {
    name: string;
    createdAt: string;
    namespace: string;
}

export interface Configuration {
    boundApps: string[] | null;
    details?: Record<string, string>;
    origin: string;
    siblings?: string[];
    type: string;
    user: string;
    variableCount?: number;
}

export interface ConfigurationResponse {
    meta: ConfigurationMeta;
    configuration: Configuration;
}

export type ListConfigurationsResponse = ListResourceResponse<ConfigurationResponse>;

export interface ConfigurationCreateRequest {
    name: string;
    data: Record<string, string>;
}

export interface ConfigurationBindRequest {
    names: string[];
}

export interface ConfigurationPutRequest {
    restart?: boolean;
    data: Record<string, string>;
}