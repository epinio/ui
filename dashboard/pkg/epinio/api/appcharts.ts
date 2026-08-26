import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListAppChartsResponse, ApiAppChartCreateRequest, ApiAppChartUpdateRequest } from "../models/appcharts/api-types";
    
export function appChartsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const appChartsBasePath = '/api/v1/appcharts';

    return {
        listAppCharts: async (params?: ApiListResourceRequestParams): Promise<ApiListAppChartsResponse> => {
            return await epinioClient.get(appChartsBasePath, { params });
        },
        createAppChart: async (request: ApiAppChartCreateRequest) => {
            return await epinioClient.post(`${appChartsBasePath}`, request);
        },
        updateAppChart: async (name: string, request: ApiAppChartUpdateRequest) => {
            return await epinioClient.patch(`${appChartsBasePath}/${name}`, request);
        },
        deleteAppChart: async (name: string) => {
            return await epinioClient.delete(`${appChartsBasePath}/${name}`);
        },
    };
}