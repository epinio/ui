import { ApiListResourceRequestParams, ApiPaginatedResponseMetadata } from "./api-types";
import { ListResourceRequestParams, PaginatedResponseMetadata } from "./ui-types";

export function toApiListResourceRequestParams(params: ListResourceRequestParams): ApiListResourceRequestParams {
    return {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
    };
}

export function toPaginatedResponseMetadata(apiMetadata: ApiPaginatedResponseMetadata): PaginatedResponseMetadata {
    return {
        page: apiMetadata.page,
        pageSize: apiMetadata.pageSize,
        totalItems: apiMetadata.totalItems,
        totalPages: apiMetadata.totalPages,
    };
}

export const statusToStateDisplay: Record<string, string> = {
    running: 'Running',
    ready: 'Ready',
    deployed: 'Deployed',
    available: 'Available',
    error: 'Error',
    notready: 'Not Ready',
    'not-ready': 'Not Ready',
    uninstalled: 'Uninstalled',
    building: 'Building',
    created: 'Created',
    updating: 'Updating',
};