import { ApiBuilderImage, ApiListBuilderImagesResponse, ApiBuilderImageCreateRequest, ApiBuilderImageUpdateRequest } from "./api-types";
import { BuilderImage, ListBuilderImagesResponse, BuilderImageCreateRequest, BuilderImageUpdateRequest } from "./ui-types";

export function toBuilderImage(apiBuilderImage: ApiBuilderImage): BuilderImage {
    return {
        meta: apiBuilderImage.meta,
        description: apiBuilderImage.description,
        shortDescription: apiBuilderImage.short_description,
        image: apiBuilderImage.image,
        boundApps: apiBuilderImage.bound_apps,
        default: apiBuilderImage.default,
    };
}

export function toListBuilderImagesResponse(apiResponse: ApiListBuilderImagesResponse): ListBuilderImagesResponse {
    const { items, ...paginationMetadata } = apiResponse;
    return {
        items: apiResponse.items.map(toBuilderImage),
        ...paginationMetadata,
    };
}

function mapBuilderImageRequest(
  uiRequest: Partial<BuilderImageCreateRequest>
): Partial<ApiBuilderImageCreateRequest> {
  const payload: Partial<ApiBuilderImageCreateRequest> = {};


  if (uiRequest.name !== undefined) {
    payload.name = uiRequest.name;
  }

  if (uiRequest.description !== undefined) {
    payload.description = uiRequest.description;
  }

  if (uiRequest.shortDescription !== undefined) {
    payload.short_description = uiRequest.shortDescription;
  }

  if (uiRequest.image !== undefined) {
    payload.image = uiRequest.image;
  }

  return payload;
}

export function toApiBuilderImageCreateRequest(
  uiRequest: BuilderImageCreateRequest
): ApiBuilderImageCreateRequest {
  return mapBuilderImageRequest(uiRequest) as ApiBuilderImageCreateRequest;
}

export function toApiBuilderImageUpdateRequest(
  uiRequest: BuilderImageUpdateRequest
): ApiBuilderImageUpdateRequest {
  return mapBuilderImageRequest(uiRequest);
}