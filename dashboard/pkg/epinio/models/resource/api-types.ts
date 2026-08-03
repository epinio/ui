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
}