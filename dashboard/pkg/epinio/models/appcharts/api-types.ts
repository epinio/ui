import { ApiChartSetting } from "../catalogservice/api-types";
import { ApiListResourceResponse } from "../resource/api-types";

export interface ApiAppChartMeta {
    name: string;
    createdAt: string;
}

export interface ApiAppChart {
    meta: ApiAppChartMeta;
    description: string;
    short_description: string;
    helm_chart?: string;
    helm_repo?: string;
    settings?: Record<string, ApiChartSetting>;
    values?: Record<string, string>;
    bound_apps?: boolean;
}

export type ApiListAppChartsResponse = ApiListResourceResponse<ApiAppChart>;

export interface ApiAppChartCreateRequest {
    name: string;
    description: string;
    short_description: string;
    helm_chart?: string;
    helm_repo?: string;
    settings?: Record<string, ApiChartSetting>;
    values?: Record<string, string>;
}

export type ApiAppChartUpdateRequest = Partial<ApiAppChartCreateRequest>;