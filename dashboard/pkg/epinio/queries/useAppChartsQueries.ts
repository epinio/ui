import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { appChartsApi } from "../api/appcharts";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListAppChartsResponse } from "../models/appcharts/mappers";

export function useAppCharts(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['appcharts', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const charts = await appChartsApi(epinioClient).listAppCharts(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListAppChartsResponse(charts);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

// export function useCatalogService(store: any, name: Ref<string>) {
//     const { data: cluster } = useCluster(store);
//     const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

//     return useQuery({
//         queryKey: computed(() => ['catalogservice', cluster.value?.id, name?.value]),
//         queryFn: async () => {
//             if (!cluster?.value) {
//                 throw new Error('Cluster is not available');
//             }
//             const epinioClient = createEpinioClient(cluster.value, isExtension.value);
//             const service = await catalogServicesApi(epinioClient).getCatalogService(name.value);
//             return toCatalogService(service);
//         },
//         enabled: computed(() => !!cluster.value && !!name.value),
//     }, epinioQueryClient);
// }   