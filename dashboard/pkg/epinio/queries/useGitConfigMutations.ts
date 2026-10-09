import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { gitConfigsApi } from "../api/gitconfigs";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { GitConfigCreateRequest } from "../models/gitconfig/ui-types";
import { toApiGitConfigCreateRequest } from "../models/gitconfig/mappers";

export function useCreateGitConfig(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ request }: { request: GitConfigCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await gitConfigsApi(epinioClient).createGitConfig(toApiGitConfigCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['gitconfigs', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useDeleteGitConfig(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await gitConfigsApi(epinioClient).deleteGitConfig(name);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['gitconfigs', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}
