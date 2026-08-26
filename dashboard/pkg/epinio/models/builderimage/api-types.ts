import { ApiListResourceResponse } from "../resource/api-types";

export interface ApiBuilderImageMeta {
    name: string;
    createdAt: string;
}

export interface ApiBuilderImage {
    meta: ApiBuilderImageMeta;
    description: string;
    short_description: string;
    image: string;
    bound_apps?: boolean;
    default?: boolean;
}

export type ApiListBuilderImagesResponse = ApiListResourceResponse<ApiBuilderImage>;

export interface ApiBuilderImageCreateRequest {
    name: string;
    description: string;
    short_description: string;
    image: string;
}

export type ApiBuilderImageUpdateRequest = Partial<ApiBuilderImageCreateRequest>;