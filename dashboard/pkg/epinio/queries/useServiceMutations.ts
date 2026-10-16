import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { servicesApi } from "../api/services";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { ServiceCreateRequest, ServiceBindRequest, ServicePutRequest, ServiceInstance } from "../models/service/ui-types";
import { toApiServiceBindRequest, toApiServiceCreateRequest, toApiServicePutRequest } from "../models/service/mappers";

export function useCreateServiceInstance(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ namespace, request }: { namespace: string; request: ServiceCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await servicesApi(epinioClient).createService(namespace, toApiServiceCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['services', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useBindServiceInstance(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, serviceName, request }: { namespace: string; serviceName: string; request: ServiceBindRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await servicesApi(epinioClient).bindService(namespace, serviceName, toApiServiceBindRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['services', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useUnbindServiceInstance(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, serviceName, request }: { namespace: string; serviceName: string; request: ServiceBindRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await servicesApi(epinioClient).unbindService(namespace, serviceName, toApiServiceBindRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['services', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useUpdateServiceInstance(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, serviceName, request }: { namespace: string; serviceName: string; request: ServicePutRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await servicesApi(epinioClient).updateService(namespace, serviceName, toApiServicePutRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['services', cluster.value?.id] });
            epinioQueryClient.invalidateQueries({ queryKey: ['service', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeleteServiceInstance(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, serviceName }: { namespace: string; serviceName: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await servicesApi(epinioClient).deleteService(namespace, serviceName);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['services', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useBulkRemoveServiceInstances(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

  return useMutation({
    mutationFn: async ({ items, deleteImage }: { items: ServiceInstance[], deleteImage: boolean }) => {
        if (!cluster?.value) {
                throw new Error('Cluster is not available');
        }
        const epinioClient = createEpinioClient(cluster.value, isExtension.value);
        const api = servicesApi(epinioClient);

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

    onMutate: async ({ items }: { items: ServiceInstance[], deleteImage: boolean }) => {
        // Optimistically update the cache to remove the deleted items
        epinioQueryClient.setQueryData(
            ['services', cluster.value?.id],
            (old: ServiceInstance[] | undefined) =>
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
            queryKey: ['services', cluster.value?.id]
        });
    },

    onSuccess: (_data, { items, deleteImage }) => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['services', cluster.value?.id]
        });

        if (onSuccessCallback) {
            onSuccessCallback();
        }
    },
  }, epinioQueryClient);
}