// shared resource types
import { ActionMenuItem } from "@krumio/trailhand-ui/dist/components/action-menu/action-menu";

export interface PaginatedResponseMetadata {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}


export interface ListResource<T> {
    items: T[];
}

export type ListResourceResponse<T> = ListResource<T> & PaginatedResponseMetadata;

export interface ListResourceRequestParams {
    page?: number;
    pageSize?: number;
    search?: string;
}

export interface ResourceTableAction {
    id: string;
    label: string;
    action: (row: any) => void;
}

export interface ResourceTableRowMeta {
    id: string;
    availableActions?: ActionMenuItem[];
}

export type ResourceTableRow = {
    [key: string]: any;
} & ResourceTableRowMeta;

export interface ResourceQueryOptions {
    enabled?: boolean;
    polling?: boolean;
}