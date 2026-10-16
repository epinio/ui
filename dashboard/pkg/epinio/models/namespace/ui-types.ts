import { ListResourceResponse } from "../resource/ui-types";

interface NamespaceMeta {
    name: string;
    createdAt: string;
}

export interface Namespace {
    meta: NamespaceMeta;
    apps: string[];
    configurations: string[];
}

export type ListNamespacesResponse = ListResourceResponse<Namespace>;

export interface CreateNamespaceRequest {
    name: string;
}