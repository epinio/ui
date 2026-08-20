import { ApiCatalogService, ApiListCatalogServicesResponse, ApiCatalogServiceCreateRequest, ApiCatalogServiceUpdateRequest } from "./api-types";
import { CatalogService, ListCatalogServicesResponse, CatalogServiceCreateRequest, CatalogServiceUpdateRequest } from "./ui-types";
import { toPaginatedResponseMetadata } from "../resource/mappers";
import { objValuesToString, mapSettingsToApiRequest } from "../../utils/settings";

export function toCatalogService(apiCatalogService: ApiCatalogService): CatalogService {
    return {
        meta: {
            name: apiCatalogService.meta.name,
            createdAt: apiCatalogService.meta.createdAt,
        },
        appVersion: apiCatalogService.app_version,
        boundServices: apiCatalogService.bound_services,
        chart: apiCatalogService.chart,
        chartVersion: apiCatalogService.chart_version,
        description: apiCatalogService.description,
        helmRepo: {
            name: apiCatalogService.helm_repo.name,
            url: apiCatalogService.helm_repo.url,
        },
        serviceIcon: apiCatalogService.service_icon,
        shortDescription: apiCatalogService.short_description,
        values: apiCatalogService.values,
        secretTypes: apiCatalogService.secret_types,
        settings: apiCatalogService.settings ? Object.entries(apiCatalogService.settings).map(([name, setting]) => ({
            name,
            type: setting.type,
            enum: setting.enum,
            maximum: setting.maximum,
            minimum: setting.minimum,
            value: apiCatalogService.values ? JSON.parse(apiCatalogService.values)[name] : undefined,
        })) : undefined,
    };
}

export function toListCatalogServicesResponse(apiResponse: ApiListCatalogServicesResponse): ListCatalogServicesResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toCatalogService),
        ...toPaginatedResponseMetadata(paginationMetadata),
    };
}

function mapCatalogServiceRequest(
  uiRequest: Partial<CatalogServiceCreateRequest>
): Partial<ApiCatalogServiceCreateRequest> {
  const payload: Partial<ApiCatalogServiceCreateRequest> = {};

  if (uiRequest.name !== undefined) {
    payload.name = uiRequest.name;
  }

  if (uiRequest.description !== undefined) {
    payload.description = uiRequest.description;
  }

  if (uiRequest.shortDescription !== undefined) {
    payload.short_description = uiRequest.shortDescription;
  }

  if (uiRequest.chart !== undefined) {
    payload.chart = uiRequest.chart;
  }

  if (uiRequest.helmRepo !== undefined) {
    payload.helm_repo = {
      name: uiRequest.helmRepo.name,
      url: uiRequest.helmRepo.url,
    };

    if (uiRequest.helmRepo.secret !== undefined) {
      payload.helm_repo.secret = uiRequest.helmRepo.secret;
    }
  }

  if (uiRequest.settings !== undefined) {
    const { settings, values } = mapSettingsToApiRequest(uiRequest.settings);

    if (Object.keys(values).length > 0) {
      payload.values = JSON.stringify(values);
    }

    if (Object.keys(settings).length > 0) {
      payload.settings = settings;
    }
  }

  if (uiRequest.secretTypes !== undefined) {
    payload.secret_types = uiRequest.secretTypes;
  }

  if (uiRequest.chartVersion !== undefined) {
    payload.chart_version = uiRequest.chartVersion;
  }

  if (uiRequest.appVersion !== undefined) {
    payload.app_version = uiRequest.appVersion;
  }

  if (uiRequest.serviceIcon !== undefined) {
    payload.service_icon = uiRequest.serviceIcon;
  }

  return payload;
}

export function toApiCatalogServiceCreateRequest(
  uiRequest: CatalogServiceCreateRequest
): ApiCatalogServiceCreateRequest {
  return mapCatalogServiceRequest(uiRequest) as ApiCatalogServiceCreateRequest;
}

export function toApiCatalogServiceUpdateRequest(
  uiRequest: CatalogServiceUpdateRequest
): ApiCatalogServiceUpdateRequest {
  return mapCatalogServiceRequest(uiRequest);
}