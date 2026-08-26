import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { builderImagesApi } from "../api/builderimages";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListBuilderImagesResponse } from "../models/builderimage/mappers";

export function useBuilderImages(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['builderimages', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const builderImages = await builderImagesApi(epinioClient).listBuilderImages(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListBuilderImagesResponse(builderImages);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}