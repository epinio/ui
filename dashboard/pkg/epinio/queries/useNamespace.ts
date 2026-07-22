import { useQuery } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";

export function useNamespaces(store: any) {
    const { data: cluster } = useCluster(store);

    return useQuery({
        queryKey: ['namespaces', cluster?.value?.id],
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value);
            const namespaces = await namespacesApi(epinioClient).listNamespaces();
            return namespaces;
        },
        enabled: computed(() => !!cluster.value),
    }, epinioQueryClient);
}