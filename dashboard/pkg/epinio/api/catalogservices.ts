import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListCatalogServicesResponse, ApiCatalogService, ApiCatalogServiceCreateRequest, ApiCatalogServiceUpdateRequest } from "../models/catalogservice/api-types";

export function catalogServicesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const catalogServicesBasePath = '/api/v1/catalogservices';

    return {
        listCatalogServices: async (params?: ApiListResourceRequestParams): Promise<ApiListCatalogServicesResponse> => {
            return await epinioClient.get(catalogServicesBasePath, { params });
        },
        getCatalogService: async (name: string): Promise<ApiCatalogService> => {
            return await epinioClient.get(`${catalogServicesBasePath}/${name}`);
        },
        createCatalogService: async (request: ApiCatalogServiceCreateRequest) => {
            return await epinioClient.post(`${catalogServicesBasePath}`, request);
        },
        updateCatalogService: async (name: string, request: ApiCatalogServiceUpdateRequest) => {
            return await epinioClient.patch(`${catalogServicesBasePath}/${name}`, request);
        },
        deleteCatalogService: async (name: string) => {
            return await epinioClient.delete(`${catalogServicesBasePath}/${name}`);
        },
    };
}