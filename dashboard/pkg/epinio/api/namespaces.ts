import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListNamespacesResponse, ApiCreateNamespaceRequest } from "../models/namespace/api-types";

export function namespacesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const basePath = '/api/v1/namespaces';

    return {
        listNamespaces: async (params?: ApiListResourceRequestParams): Promise<ApiListNamespacesResponse> => {
            return await epinioClient.get(basePath, { params });
        },
        createNamespace: async (request: ApiCreateNamespaceRequest) => {
            return await epinioClient.post(basePath, request);
        },
        deleteNamespace: async (name: string) => {
            return await epinioClient.delete(`${basePath}/${name}`);
        }
    };
}