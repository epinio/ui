import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListBuilderImagesResponse, ApiBuilderImageCreateRequest, ApiBuilderImageUpdateRequest } from "../models/builderimage/api-types";
    
export function builderImagesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const builderImagesBasePath = '/api/v1/builderimages';

    return {
        listBuilderImages: async (params?: ApiListResourceRequestParams): Promise<ApiListBuilderImagesResponse> => {
            return await epinioClient.get(builderImagesBasePath, { params });
        },
        createBuilderImage: async (request: ApiBuilderImageCreateRequest) => {
            return await epinioClient.post(`${builderImagesBasePath}`, request);
        },
        updateBuilderImage: async (name: string, request: ApiBuilderImageUpdateRequest) => {
            return await epinioClient.patch(`${builderImagesBasePath}/${name}`, request);
        },
        deleteBuilderImage: async (name: string) => {
            return await epinioClient.delete(`${builderImagesBasePath}/${name}`);
        },
    };
}