import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { configurationsApi } from "../api/configurations";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListConfigurationsResponse } from "../models/configuration/mappers";

export function useConfigurations(store: any, params?: Ref<ListResourceRequestParams>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['configurations', cluster.value?.id, params]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const configurations = await configurationsApi(epinioClient).listConfigurations(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListConfigurationsResponse(configurations);
        },
        enabled: computed(() => !!cluster.value),
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}