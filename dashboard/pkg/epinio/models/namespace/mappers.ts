import { ApiListNamespacesResponse, ApiNamespace, ApiCreateNamespaceRequest } from "./api-types";
import { ListNamespacesResponse, Namespace, CreateNamespaceRequest } from "./ui-types";
import { toPaginatedResponseMetadata } from "../resource/mappers";

export function toNamespace(apiNamespace: ApiNamespace): Namespace {
    return {
        meta: {
            name: apiNamespace.meta.name,
            createdAt: apiNamespace.meta.createdAt,
        },
        apps: apiNamespace.apps,
        configurations: apiNamespace.configurations,
    };
}

export function toListNamespacesResponse(apiResponse: ApiListNamespacesResponse): ListNamespacesResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: items.map(toNamespace),
        ...toPaginatedResponseMetadata(paginationMetadata),
    };
}

export function toApiCreateNamespaceRequest(request: CreateNamespaceRequest): ApiCreateNamespaceRequest {
    return {
        name: request.name,
    };
}