import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { gitConfigsApi } from "../api/gitconfigs";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListGitConfigsResponse, toGitConfig } from "../models/gitconfig/mappers";

export function useGitConfigs(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitconfigs', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const charts = await gitConfigsApi(epinioClient).listGitConfigs(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListGitConfigsResponse(charts);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

export function useGitConfig(store: any, name: string, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['gitconfig', cluster.value?.id, name]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const config = await gitConfigsApi(epinioClient).getGitConfig(name);
            return toGitConfig(config);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true,
    }, epinioQueryClient);
}