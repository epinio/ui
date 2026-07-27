import { ListResourceResponse } from "../resource/types";

interface ServiceInstanceMeta {
    name: string;
    createdAt: string;
    namespace: string;
}

export interface ServiceInstance {
    meta: ServiceInstanceMeta;
    catalog_service: string;
    catalog_service_version: string;
    status: string;
}

export type ListServiceInstancesResponse = ListResourceResponse<ServiceInstance>;
