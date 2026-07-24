import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListNamespacesRequestParams } from "../models/namespace/types";

export function useNamespaces(store: any, params?: Ref<ListNamespacesRequestParams>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['namespaces', cluster.value?.id, params]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const namespaces = await namespacesApi(epinioClient).listNamespaces(params?.value);
            return namespaces;
        },
        enabled: computed(() => !!cluster.value),
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}