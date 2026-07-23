import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { ListNamespacesRequestParams } from "../models/namespace/types";

export function useNamespaces(store: any, params?: ListNamespacesRequestParams) {
    const { data: cluster } = useCluster(store);

    return useQuery({
        queryKey: ['namespaces', cluster?.value?.id, params],
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value);
            const namespaces = await namespacesApi(epinioClient).listNamespaces(params);
            return namespaces;
        },
        enabled: computed(() => !!cluster.value),
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}