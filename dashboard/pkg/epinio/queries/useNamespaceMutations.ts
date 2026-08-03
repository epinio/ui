import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { CreateNamespaceRequest } from "../models/namespace/ui-types";
import { toApiCreateNamespaceRequest } from "../models/namespace/mappers";

export function useCreateNamespace(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async (request: CreateNamespaceRequest) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await namespacesApi(epinioClient).createNamespace(toApiCreateNamespaceRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['namespaces', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useDeleteNamespace(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async (name: string) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await namespacesApi(epinioClient).deleteNamespace(name);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['namespaces', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}