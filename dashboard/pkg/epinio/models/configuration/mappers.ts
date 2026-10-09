import { ApiListConfigurationsResponse, ApiConfigurationResponse, ApiConfigurationCreateRequest, ApiConfigurationBindRequest, ApiConfigurationPutRequest } from "./api-types";
import { ListConfigurationsResponse, ConfigurationResponse, ConfigurationCreateRequest, ConfigurationBindRequest, ConfigurationPutRequest } from "./ui-types";
import { toPaginatedResponseMetadata } from "../resource/mappers";

export function toConfigurationResponse(apiResponse: ApiConfigurationResponse): ConfigurationResponse {
    return {
        meta: {
            name: apiResponse.meta.name,
            createdAt: apiResponse.meta.createdAt,
            namespace: apiResponse.meta.namespace,
        },
        configuration: {
            boundApps: apiResponse.configuration.boundapps,
            details: apiResponse.configuration.details,
            origin: apiResponse.configuration.origin,
            siblings: apiResponse.configuration.siblings,
            type: apiResponse.configuration.type,
            user: apiResponse.configuration.user,
            variableCount: Object.keys(apiResponse.configuration.details || {}).length,
        },
    };
}

export function toListConfigurationsResponse(apiResponse: ApiListConfigurationsResponse): ListConfigurationsResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toConfigurationResponse),
        ...toPaginatedResponseMetadata(paginationMetadata),
    };
}

export function toApiConfigurationCreateRequest(request: ConfigurationCreateRequest): ApiConfigurationCreateRequest {
    return {
        name: request.name,
        data: request.data,
    };
}

export function toApiConfigurationBindRequest(request: ConfigurationBindRequest): ApiConfigurationBindRequest {
    return {
        names: request.names,
    };
}

export function toApiConfigurationPutRequest(request: ConfigurationPutRequest): ApiConfigurationPutRequest {
    return {
        restart: request.restart,
        data: request.data,
    };
}
