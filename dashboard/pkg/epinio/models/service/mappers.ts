import { ApiListServiceInstancesResponse, ApiServiceInstance, ApiServiceCreateRequest, ApiServiceBindRequest, ApiServicePutRequest } from "./api-types";
import { ListServiceInstancesResponse, ServiceInstance, ServiceCreateRequest, ServiceBindRequest, ServicePutRequest } from "./ui-types";
import { toPaginatedResponseMetadata } from "../resource/mappers";
import { statusToStateDisplay } from "../resource/mappers";

export function toServiceInstance(apiServiceInstance: ApiServiceInstance): ServiceInstance {
    return {
        meta: {
            name: apiServiceInstance.meta.name,
            createdAt: apiServiceInstance.meta.createdAt,
            namespace: apiServiceInstance.meta.namespace,
        },
        catalogService: apiServiceInstance.catalog_service,
        catalogServiceVersion: apiServiceInstance.catalog_service_version,
        status: apiServiceInstance.status,
        stateDisplay: statusToStateDisplay[apiServiceInstance.status],
        boundApps: apiServiceInstance.boundapps,
        details: apiServiceInstance.details,
        internalRoutes: apiServiceInstance.internal_routes,
        secretTypes: apiServiceInstance.secretTypes,
        settings: apiServiceInstance.settings,
    };
}

export function toListServiceInstancesResponse(apiResponse: ApiListServiceInstancesResponse): ListServiceInstancesResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toServiceInstance),
        ...toPaginatedResponseMetadata(paginationMetadata),
    };
}

export function toApiServiceCreateRequest(request: ServiceCreateRequest): ApiServiceCreateRequest {
    return {
        name: request.name,
        catalog_service: request.catalogService,
        settings: request.settings,
        wait: request.wait,
    };
}

export function toApiServiceBindRequest(request: ServiceBindRequest): ApiServiceBindRequest {
    return {
        app_name: request.appName,
    };
}

export function toApiServicePutRequest(request: ServicePutRequest): ApiServicePutRequest {
    return {
        restart: request.restart,
        settings: request.settings,
        wait: request.wait,
    };
}