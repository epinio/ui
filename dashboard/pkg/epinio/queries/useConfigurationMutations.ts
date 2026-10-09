import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { configurationsApi } from "../api/configurations";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { ConfigurationCreateRequest, ConfigurationBindRequest, ConfigurationPutRequest, ConfigurationResponse } from "../models/configuration/ui-types";
import { toApiConfigurationCreateRequest, toApiConfigurationBindRequest, toApiConfigurationPutRequest } from "../models/configuration/mappers";

export function useCreateConfiguration(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ namespace, request }: { namespace: string; request: ConfigurationCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await configurationsApi(epinioClient).createConfiguration(namespace, toApiConfigurationCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['configurations', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useBindConfiguration(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, appName, request }: { namespace: string; appName: string; request: ConfigurationBindRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await configurationsApi(epinioClient).bindApplication(namespace, appName, toApiConfigurationBindRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['configurations', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useUnbindConfiguration(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, appName, configName }: { namespace: string; appName: string; configName: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await configurationsApi(epinioClient).unbindConfiguration(namespace, appName, configName);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['configurations', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useUpdateConfiguration(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, configurationName, request }: { namespace: string; configurationName: string; request: ConfigurationPutRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await configurationsApi(epinioClient).updateConfiguration(namespace, configurationName, toApiConfigurationPutRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['configurations', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeleteConfiguration(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, configurationName }: { namespace: string; configurationName: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await configurationsApi(epinioClient).deleteConfiguration(namespace, configurationName);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['configurations', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useBulkRemoveConfigurations(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

  return useMutation({
    mutationFn: async ({ items, deleteImage }: { items: ConfigurationResponse[], deleteImage: boolean }) => {
        if (!cluster?.value) {
                throw new Error('Cluster is not available');
        }
        const epinioClient = createEpinioClient(cluster.value, isExtension.value);
        const api = configurationsApi(epinioClient);

        // Delete endpoints are grouped by namespace
        const byNamespace = items.reduce<Record<string, string[]>>((acc, item) => {
            const ns = item.meta.namespace;
            acc[ns] ??= [];
            acc[ns].push(item.meta.name);
            return acc;
        }, {});

        await Promise.all(
            Object.entries(byNamespace).map(([namespace, names]) =>
                api.bulkDelete(namespace, names, { unbind: true, deleteImage })
            )
        );
    },

    onMutate: async ({ items }: { items: ConfigurationResponse[], deleteImage: boolean }) => {
        // Optimistically update the cache to remove the deleted items
        epinioQueryClient.setQueryData(
            ['configurations', cluster.value?.id],
            (old: ConfigurationResponse[] | undefined) =>
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
            queryKey: ['configurations', cluster.value?.id]
        });
    },

    onSuccess: (_data, { items, deleteImage }) => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['configurations', cluster.value?.id]
        });

        if (onSuccessCallback) {
            onSuccessCallback();
        }
    },
  }, epinioQueryClient);
}