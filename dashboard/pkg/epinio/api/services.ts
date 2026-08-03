import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListServiceInstancesResponse, ApiServiceCreateRequest, ApiServiceBindRequest, ApiServicePutRequest } from "../models/service/api-types";

export function servicesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const servicesBasePath = '/api/v1/services';
    const namespacesBasePath = '/api/v1/namespaces';

    return {
        listServices: async (params?: ApiListResourceRequestParams): Promise<ApiListServiceInstancesResponse> => {
            return await epinioClient.get(servicesBasePath, { params });
        },
        createService: async (namespace: string, request: ApiServiceCreateRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/services`, request);
        },
        bindService: async (namespace: string, serviceName: string, request: ApiServiceBindRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/services/${serviceName}/bind`, request);
        },
        unbindService: async (namespace: string, serviceName: string, request: ApiServiceBindRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/services/${serviceName}/unbind`, request);
        },
        updateService: async (namespace: string, serviceName: string, request: ApiServicePutRequest) => {
            return await epinioClient.put(`${namespacesBasePath}/${namespace}/services/${serviceName}`, request);
        },
        deleteService: async (namespace: string, serviceName: string) => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/services/${serviceName}`, { unmounted: true });
        },
    };
}