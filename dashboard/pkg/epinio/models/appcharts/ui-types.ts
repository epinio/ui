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