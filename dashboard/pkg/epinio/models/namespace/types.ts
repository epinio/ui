interface PaginatedResponseMetadata {
    total: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

interface NamespaceMeta {
    name: string;
    createdAt: string;
}

export interface Namespace {
    meta: NamespaceMeta;
    apps: string[];
    configurations: string[];
}

export interface ListNamespaces {
    items: Namespace[];
}

export type ListNamespacesResponse = ListNamespaces & PaginatedResponseMetadata;

export interface ListNamespacesRequestParams {
    page?: number;
    pageSize?: number;
    search?: string;
}

export interface CreateNamespaceRequest {
    name: string;
}