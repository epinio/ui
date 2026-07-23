import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { namespacesApi } from "../api/namespaces";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { CreateNamespaceRequest } from "../models/namespace/types";

export function useCreateNamespace(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);

    return useMutation({
        mutationFn: async (request: CreateNamespaceRequest) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value);
            return await namespacesApi(epinioClient).createNamespace(request);
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

    return useMutation({
        mutationFn: async (name: string) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value);
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