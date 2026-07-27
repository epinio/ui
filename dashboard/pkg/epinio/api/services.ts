import { createEpinioClient } from "./client";
import { ListResourceRequestParams } from "../models/resource/types";
import { ListServiceInstancesResponse } from "../models/service/types";

export function servicesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const basePath = '/api/v1/services';

    return {
        listServices: async (params?: ListResourceRequestParams): Promise<ListServiceInstancesResponse> => {
            return await epinioClient.get(basePath, { params });
        },
        // createService: async (request: CreateServiceInstanceRequest) => {
        //     return await epinioClient.post(basePath, request);
        // },
        // deleteService: async (name: string) => {
        //     return await epinioClient.delete(`${basePath}/${name}`);
        // }
    };
}