// API Response & Request Types
export interface ApiPaginatedResponseMetadata {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface ApiListResource<T> {
    items: T[];
}

export type ApiListResourceResponse<T> = ApiListResource<T> & ApiPaginatedResponseMetadata;

export interface ApiListResourceRequestParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string; // Server-side sort field (e.g. name, createdAt, namespace)
    sortDir?: 'asc' | 'desc';
    namespaces?: string; // Filter namespaced resources by their namespace
    app?: string; // Filter by application name for configs and services
}