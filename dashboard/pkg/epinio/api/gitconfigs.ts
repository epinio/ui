import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListGitConfigsResponse, ApiGitConfigCreateRequest } from "../models/gitconfig/api-types";
    
export function gitConfigsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const gitConfigsBasePath = '/api/v1/gitconfigs';

    return {
        listGitConfigs: async (params?: ApiListResourceRequestParams): Promise<ApiListGitConfigsResponse> => {
            return await epinioClient.get(gitConfigsBasePath, { params });
        },
        createGitConfig: async (request: ApiGitConfigCreateRequest) => {
            return await epinioClient.post(`${gitConfigsBasePath}`, request);
        },
        deleteGitConfig: async (name: string) => {
            return await epinioClient.delete(`${gitConfigsBasePath}/${name}`);
        },
    };
}