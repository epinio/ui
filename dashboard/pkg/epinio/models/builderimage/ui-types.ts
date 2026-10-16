import { ListResourceResponse } from "../resource/ui-types";

export interface BuilderImageMeta {
    name: string;
    createdAt: string;
}

export interface BuilderImage {
    meta: BuilderImageMeta;
    description: string;
    shortDescription: string;
    image: string;
    boundApps?: boolean;
    default?: boolean;
}

export type ListBuilderImagesResponse = ListResourceResponse<BuilderImage>;

export interface BuilderImageCreateRequest {
    name: string;
    description: string;
    shortDescription: string;
    image: string;
}

export type BuilderImageUpdateRequest = Partial<BuilderImageCreateRequest>;