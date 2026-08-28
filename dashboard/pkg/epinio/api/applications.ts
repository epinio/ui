import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListAppsResponse } from "../models/application/api-types";
    
export function applicationsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const appsBasePath = '/api/v1/applications';

    return {
        listApps: async (params?: ApiListResourceRequestParams): Promise<ApiListAppsResponse> => {
            return await epinioClient.get(appsBasePath, { params });
        },
    };
}