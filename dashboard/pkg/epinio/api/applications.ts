import { createEpinioClient } from "./client";
import { ApiListResourceRequestParams } from "../models/resource/api-types";
import { ApiListAppsResponse, ApiAppDeploymentStatus, ApiAsyncDeployRequest, ApiAppStageRequest, ApiAppStageResponse, ApiApp, ApiAppDeployRequest, ApiAppDeployResponse } from "../models/application/api-types";
    
export function applicationsApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const appsBasePath = '/api/v1/applications';
    const namespacesBasePath = '/api/v1/namespaces';

    return {
        listApps: async (params?: ApiListResourceRequestParams): Promise<ApiListAppsResponse> => {
            return await epinioClient.get(appsBasePath, { params });
        },
        getApp: async (namespace: string, app: string): Promise<ApiApp> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}`);
        },
        fetchPart: async (namespace: string, app: string, part: string, signal?: AbortSignal): Promise<any> => {
            const isText = part === 'values' || part === 'manifest';
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}/part/${part}`, { responseType: isText ? 'text' : 'blob', signal });
        },
        fetchDeploymentStatus: async (namespace: string, app: string, deploymentId: string): Promise<ApiAppDeploymentStatus> => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/applications/${app}/deployments/${deploymentId}`);
        },
        startAsyncDeploy: async (namespace: string, app: string, body: ApiAsyncDeployRequest): Promise<ApiAppDeploymentStatus> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/deployments`, body);
        },
        stage: async (namespace: string, app: string, body: ApiAppStageRequest): Promise<ApiAppStageResponse> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/stage`, body);
        },
        waitForStaging: async (namespace: string, stageId: string) => {
            return await epinioClient.get(`${namespacesBasePath}/${namespace}/staging/${stageId}/complete`);
        },
        deploy: async (namespace: string, app: string, body: ApiAppDeployRequest): Promise<ApiAppDeployResponse> => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/deploy`, body);
        },
        restart: async (namespace: string, app: string) => {
            return await epinioClient.post(`${namespacesBasePath}/${namespace}/applications/${app}/restart`);
        }
    };
}