import { ApiListResourceResponse } from "../resource/api-types";

interface ApiNamespaceMeta {
    name: string;
    createdAt: string;
}

export interface ApiNamespace {
    meta: ApiNamespaceMeta;
    apps?: string[];
    configurations?: string[];  
    services?: string[];
}

export type ApiListNamespacesResponse = ApiListResourceResponse<ApiNamespace>;

export interface ApiCreateNamespaceRequest {
    name: string;
}