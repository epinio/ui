import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams, ApiResourceResponse } from "../models/resource/api-types";
import { ApiConfigurationCreateRequest, ApiListConfigurationsResponse, ApiConfigurationBindRequest, ApiConfigurationPutRequest, ApiConfigurationResponse } from "../models/configuration/api-types";
import { ApiOperationsResponse } from "../models/application/api-types";

export function configurationsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const configurationsBasePath = '/api/v1/configurations';
    const namespacesBasePath = '/api/v1/namespaces';

    return {
        listConfigurations: async (params?: ApiListResourceRequestParams): Promise<ApiListConfigurationsResponse> => {
            return await epinioClient.get(configurationsBasePath, { params });
        },
        listNamespacedConfigurations: async (namespace: string, params?: ApiListResourceRequestParams): Promise<ApiListConfigurationsResponse> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/configurations`, { params });
        },
        getConfiguration: async (namespace: string, configName: string): Promise<ApiConfigurationResponse> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/configurations/${configName}`);
        },
        createConfiguration: async (namespace: string, request: ApiConfigurationCreateRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/configurations`, request);
        },
        bindApplication: async (namespace: string, appName: string, request: ApiConfigurationBindRequest): Promise<ApiOperationsResponse> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${appName}/configurationbindings`, request);
        },
        unbindConfiguration: async (namespace: string, appName: string, configName: string ): Promise<ApiResourceResponse | ApiOperationsResponse> => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/applications/${appName}/configurationbindings/${configName}`);
        },
        updateConfiguration: async (namespace: string, configurationName: string, request: ApiConfigurationPutRequest): Promise<ApiResourceResponse> => {
            return await epinioClient.put(`${namespacesBasePath}/${namespace}/configurations/${configurationName}`, request);
        },
        deleteConfiguration: async (namespace: string, configurationName: string): Promise<ApiOperationsResponse> => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/configurations/${configurationName}`, { unbind: true });
        },
        bulkDelete: async (
            namespace: string,
            names: string[],
            opts: { unbind?: boolean; deleteImage?: boolean } = {}
        ) => {
            const query = names
            .map(name => `configurations[]=${encodeURIComponent(name)}`)
            .join('&');

            return epinioClient.delete(
                `${namespacesBasePath}/${namespace}/configurations?${query}`,
                { unbind: true, ...(opts.deleteImage && { deleteImage: true }) }
            );
        },
    };
}