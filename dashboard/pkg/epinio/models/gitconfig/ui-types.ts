import { ListResourceResponse } from "../resource/ui-types";

export interface GitConfigMeta {
    name: string;
    createdAt: string;
}

export interface GitConfig {
    meta: GitConfigMeta;
    description: string;
    provider: string;
    url?: string;
    username?: string;
    password?: string;
    certs?: string;
    skipssl?: boolean;
    global?: boolean;
    boundApps?: boolean;
}

export type ListGitConfigsResponse = ListResourceResponse<GitConfig>;

export interface GitConfigCreateRequest {
    id: string;
    provider: string;
    url?: string;
    username?: string;
    password?: string;
    certs?: string;
    skipssl?: boolean;
    global?: boolean;
}