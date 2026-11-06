import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListAppsResponse, ApiAppStageRequest, ApiAppOperation, ApiApp, ApiAppDeployRequest, ApiAppDeleteRequest, ApiAppCreateRequest, ApiAppUpdateRequest, ApiAppStoreArchiveResponse, ApiAppState } from "../models/application/api-types";
import { ApiResourceResponse } from "../models/resource/api-types";
    
export function applicationsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const appsBasePath = '/api/v1/applications';
    const namespacesBasePath = '/api/v1/namespaces';

    return {
        state: async (namespace: string, app: string): Promise<ApiAppState> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}/state`);
        },
        listApps: async (params?: ApiListResourceRequestParams, undeployed?: boolean): Promise<ApiListAppsResponse> => {
            return await epinioClient.get(`${appsBasePath}${undeployed ? '/undeployed' : ''}`, { params });
        },
        getApp: async (namespace: string, app: string): Promise<ApiApp> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}`);
        },
        fetchPart: async (namespace: string, app: string, part: string, signal?: AbortSignal): Promise<any> => {
            const isText = part === 'values' || part === 'manifest';
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}/part/${part}`, { responseType: isText ? 'text' : 'blob', signal });
        },
        stage: async (namespace: string, app: string, body: ApiAppStageRequest): Promise<ApiAppOperation> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/stage`, body);
        },
        deploy: async (namespace: string, app: string, body: ApiAppDeployRequest): Promise<ApiAppOperation> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/deploy`, body);
        },
        restart: async (namespace: string, app: string): Promise<ApiAppOperation> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/restart`);
        },
        deleteApp: async (namespace: string, app: string, body: ApiAppDeleteRequest): Promise<void> => {
            return await epinioClient.delete(`${namespacesBasePath}/${namespace}/applications/${app}`, body);
        },
        bulkDelete: async (
            namespace: string,
            names: string[],
            body: ApiAppDeleteRequest
        ) => {
            const query = names
            .map(name => `applications[]=${encodeURIComponent(name)}`)
            .join('&');

            return epinioClient.delete(
                `${namespacesBasePath}/${namespace}/applications?${query}`,
                body
            );
        },
        createApp: async (namespace: string, body: ApiAppCreateRequest): Promise<ApiResourceResponse> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications`, body);
        },
        updateApp: async (namespace: string, app: string, body: ApiAppUpdateRequest): Promise<ApiResourceResponse | ApiAppOperation> => {
            return await epinioClient.patch(`${namespacesBasePath}/${namespace}/applications/${app}`, body);
        },
        storeArchive: async (namespace: string, app: string, data: FormData, size: string): Promise<ApiAppStoreArchiveResponse> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/store`, data, { headers: { 'File-Size': size } });
        },
    };
}