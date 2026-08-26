import { ApiAppChart, ApiListAppChartsResponse, ApiAppChartCreateRequest, ApiAppChartUpdateRequest } from "./api-types";
import { AppChart, ListAppChartsResponse, AppChartCreateRequest, AppChartUpdateRequest } from "./ui-types";
import { toPaginatedResponseMetadata } from "../resource/mappers";
import { mapSettingsToApiRequest } from "../../utils/settings";

export function toAppChart(apiAppChart: ApiAppChart): AppChart {
    return {
        meta: apiAppChart.meta,
        description: apiAppChart.description,
        shortDescription: apiAppChart.short_description,
        helmChart: apiAppChart.helm_chart,
        helmRepo: apiAppChart.helm_repo,
        settings: apiAppChart.settings ? Object.entries(apiAppChart.settings).map(([name, setting]) => ({
            name,
            type: setting.type,
            enum: setting.enum,
            maximum: setting.maximum,
            minimum: setting.minimum,
            value: apiAppChart.values?.[name]
        })) : undefined,
        boundApps: apiAppChart.bound_apps,
    };
}

export function toListAppChartsResponse(apiResponse: ApiListAppChartsResponse): ListAppChartsResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toAppChart),
        ...toPaginatedResponseMetadata(paginationMetadata),
    };
}

function mapAppChartRequest(
  uiRequest: Partial<AppChartCreateRequest>
): Partial<ApiAppChartCreateRequest> {
  const payload: Partial<ApiAppChartCreateRequest> = {};

  const { settings, values } = mapSettingsToApiRequest(uiRequest.settings || []);

  if (uiRequest.name !== undefined) {
    payload.name = uiRequest.name;
  }

  if (uiRequest.description !== undefined) {
    payload.description = uiRequest.description;
  }

  if (uiRequest.shortDescription !== undefined) {
    payload.short_description = uiRequest.shortDescription;
  }

  if (uiRequest.helmChart !== undefined) {
    payload.helm_chart = uiRequest.helmChart;
  }

  if (uiRequest.helmRepo !== undefined) {
    payload.helm_repo = uiRequest.helmRepo;
  }

  if (settings && Object.keys(settings).length > 0) {
    payload.settings = settings;
  }

  if (values && Object.keys(values).length > 0) {
    payload.values = values;
  }

  return payload;
}

export function toApiAppChartCreateRequest(
  uiRequest: AppChartCreateRequest
): ApiAppChartCreateRequest {
  return mapAppChartRequest(uiRequest) as ApiAppChartCreateRequest;
}

export function toApiAppChartUpdateRequest(
  uiRequest: AppChartUpdateRequest
): ApiAppChartUpdateRequest {
  return mapAppChartRequest(uiRequest);
}