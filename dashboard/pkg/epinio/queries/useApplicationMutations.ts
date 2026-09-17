import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { applicationsApi } from "../api/applications";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { AppDeleteRequest, App } from "../models/application/ui-types";
import { toApiAppDeleteRequest } from "../models/application/mappers";

export function useDeleteApplication(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, body }: { namespace: string; app: string, body: AppDeleteRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await applicationsApi(epinioClient).deleteApp(namespace, app, toApiAppDeleteRequest(body));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useBulkRemoveApplications(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

  return useMutation({
    mutationFn: async ({ items, settings }: { items: App[], settings: AppDeleteRequest }) => {
        if (!cluster?.value) {
                throw new Error('Cluster is not available');
        }
        const epinioClient = createEpinioClient(cluster.value, isExtension.value);
        const api = applicationsApi(epinioClient);

        // Delete endpoints are grouped by namespace
        const byNamespace = items.reduce<Record<string, string[]>>((acc, item) => {
            const ns = item.meta.namespace;
            acc[ns] ??= [];
            acc[ns].push(item.meta.name);
            return acc;
        }, {});

        await Promise.all(
            Object.entries(byNamespace).map(([namespace, names]) =>
                api.bulkDelete(namespace, names, toApiAppDeleteRequest(settings))
            )
        );
    },

    onMutate: async ({ items }: { items: App[], settings: AppDeleteRequest }) => {
        // Optimistically update the cache to remove the deleted items
        epinioQueryClient.setQueryData(
            ['applications', cluster.value?.id],
            (old: App[] | undefined) =>
            old?.filter(
                existing => !items.some(
                    removed => removed.meta.name === existing.meta.name &&
                    removed.meta.namespace === existing.meta.namespace
                )
            ) ?? []
        );
    },

    onError: (_err, _vars) => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['applications', cluster.value?.id]
        });
    },

    onSuccess: (_data, { items, settings }) => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['applications', cluster.value?.id]
        });

        if (onSuccessCallback) {
            onSuccessCallback();
        }
    },
  }, epinioQueryClient);
}