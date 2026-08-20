import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { catalogServicesApi } from "../api/catalogservices";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListCatalogServicesResponse, toCatalogService } from "../models/catalogservice/mappers";

export function useCatalogServices(store: any, params?: Ref<ListResourceRequestParams>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['catalogservices', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const services = await catalogServicesApi(epinioClient).listCatalogServices(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListCatalogServicesResponse(services);
        },
        enabled: computed(() => !!cluster.value),
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}

export function useCatalogService(store: any, name: Ref<string>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['catalogservice', cluster.value?.id, name?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const service = await catalogServicesApi(epinioClient).getCatalogService(name.value);
            return toCatalogService(service);
        },
        enabled: computed(() => !!cluster.value && !!name.value),
    }, epinioQueryClient);
}   