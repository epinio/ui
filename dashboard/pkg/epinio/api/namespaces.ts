import { createEpinioClient } from "./client";
import { ListResourceRequestParams } from "../models/resource/types";
import { ListNamespacesResponse, CreateNamespaceRequest } from "../models/namespace/types";

export function namespacesApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const basePath = '/api/v1/namespaces';

    return {
        listNamespaces: async (params?: ListResourceRequestParams): Promise<ListNamespacesResponse> => {
            return await epinioClient.get(basePath, { params });
        },
        createNamespace: async (request: CreateNamespaceRequest) => {
            return await epinioClient.post(basePath, request);
        },
        deleteNamespace: async (name: string) => {
            return await epinioClient.delete(`${basePath}/${name}`);
        }
    };
}