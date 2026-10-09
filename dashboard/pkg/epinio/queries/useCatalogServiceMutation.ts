import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { catalogServicesApi } from "../api/catalogservices";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { CatalogServiceCreateRequest, CatalogServiceUpdateRequest } from "../models/catalogservice/ui-types";
import { toApiCatalogServiceCreateRequest, toApiCatalogServiceUpdateRequest } from "../models/catalogservice/mappers";

export function useCreateCatalogService(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ request }: { request: CatalogServiceCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await catalogServicesApi(epinioClient).createCatalogService(toApiCatalogServiceCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['catalogservices', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useUpdateCatalogService(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name, request }: { name: string, request: CatalogServiceUpdateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await catalogServicesApi(epinioClient).updateCatalogService(name, toApiCatalogServiceUpdateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['catalogservices', cluster.value?.id] });
            epinioQueryClient.invalidateQueries({ queryKey: ['catalogservice', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeleteCatalogService(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await catalogServicesApi(epinioClient).deleteCatalogService(name);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['catalogservices', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}
