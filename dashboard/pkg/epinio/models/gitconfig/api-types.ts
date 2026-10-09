import { ApiListResourceResponse } from "../resource/api-types";

export interface ApiGitConfigMeta {
    name: string;
    createdAt: string;
}

export interface ApiGitConfig {
    meta: ApiGitConfigMeta;
    description: string;
    provider: string;
    url?: string;
    username?: string;
    password?: string;
    certs?: string;
    skipssl?: boolean;
    global?: boolean;
    bound_apps?: boolean;
}

export type ApiListGitConfigsResponse = ApiListResourceResponse<ApiGitConfig>;

export interface ApiGitConfigCreateRequest {
    id: string;
    provider: string;
    url?: string;
    username?: string;
    password?: string;
    certs?: string;
    skipssl?: boolean;
    global?: boolean;
}