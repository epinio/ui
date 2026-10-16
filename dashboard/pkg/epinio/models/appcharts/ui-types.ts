import { ChartSetting } from "../catalogservice/ui-types";
import { ListResourceResponse } from "../resource/ui-types";

export interface AppChartMeta {
    name: string;
    createdAt: string;
}

export interface AppChart {
    meta: AppChartMeta;
    description: string;
    shortDescription: string;
    helmChart?: string;
    helmRepo?: string;
    settings?: ChartSetting[];
    boundApps?: boolean;
}

export type ListAppChartsResponse = ListResourceResponse<AppChart>;

export interface AppChartCreateRequest {
    name: string;
    description: string;
    shortDescription: string;
    helmChart?: string;
    helmRepo?: string;
    settings?: ChartSetting[];
}

export type AppChartUpdateRequest = Partial<AppChartCreateRequest>;

// A push uploads the chart archive itself, so it carries no helm urls and no settings.
export interface AppChartPushRequest {
    name: string;
    description: string;
    shortDescription: string;
    archive: File;
}

export interface AppChartPushResponse {
    name: string;
    helmChart: string;
    helmRepo: string;
}