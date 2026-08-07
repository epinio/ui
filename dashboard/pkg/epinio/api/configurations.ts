import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiConfigurationCreateRequest, ApiListConfigurationsResponse, ApiConfigurationBindRequest, ApiConfigurationPutRequest } from "../models/configuration/api-types";

export function configurationsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const configurationsBasePath = '/api/v1/configurations';
    const namespacesBasePath = '/api/v1/namespaces';

    return {
        listConfigurations: async (params?: ApiListResourceRequestParams): Promise<ApiListConfigurationsResponse> => {
            return await epinioClient.get(configurationsBasePath, { params });
        },
        createConfiguration: async (namespace: string, request: ApiConfigurationCreateRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/configurations`, request);
        },
        bindApplication: async (namespace: string, appName: string, request: ApiConfigurationBindRequest) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${appName}/configurationbindings`, request);
        },
        unbindConfiguration: async (namespace: string, appName: string, configName: string ) => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/applications/${appName}/configurationbindings/${configName}`);
        },
        updateConfiguration: async (namespace: string, configurationName: string, request: ApiConfigurationPutRequest) => {
            return await epinioClient.put(`${namespacesBasePath}/${namespace}/configurations/${configurationName}`, request);
        },
        deleteConfiguration: async (namespace: string, configurationName: string) => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/configurations/${configurationName}`, { unmounted: true });
        },
        // bulkDelete: async (
        //     namespace: string,
        //     names: string[],
        //     opts: { unbind?: boolean; deleteImage?: boolean } = {}
        // ) => {
        //     const query = names
        //     .map(name => `services[]=${encodeURIComponent(name)}`)
        //     .join('&');

        //     return epinioClient.delete(
        //         `${namespacesBasePath}/${namespace}/services?${query}`,
        //         { unbind: true, ...(opts.deleteImage && { deleteImage: true }) }
        //     );
        // },
    };
}