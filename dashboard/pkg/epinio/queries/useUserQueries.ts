import { useQuery } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { userApi } from "../api/user";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { toUser } from "../models/user/mappers";

export function useUser(store: any) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['user', cluster.value?.id]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const apiUser = await userApi(epinioClient).getUser();
            return toUser(apiUser);
        },
        enabled: computed(() => !!cluster.value),
        staleTime: 0, // ensure permissions reflect current user
        retry: true,
    }, epinioQueryClient);
}