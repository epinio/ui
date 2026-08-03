import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListNamespacesResponse } from "../models/namespace/mappers";

export function useNamespaces(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['namespaces', cluster.value?.id, params]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const namespaces = await namespacesApi(epinioClient).listNamespaces(toApiListResourceRequestParams(params.value));
            const namespacesResponse = toListNamespacesResponse(namespaces);
            return namespacesResponse;
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}