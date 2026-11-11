import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { applicationsApi } from "../api/applications";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { ApiResourceResponse } from "../models/resource/api-types";
import { AppDeleteRequest, App, AppCreateRequest, AppUpdateRequest, AppDeployRequest, AppOperation, AppStageRequest } from "../models/application/ui-types";
import { toApiAppDeleteRequest, toApiAppCreateRequest, toApiAppUpdateRequest, toAppStoreArchiveResponse, toApp, toApiAppStageRequest, toApiAppDeployRequest, toAppOperation } from "../models/application/mappers";

export function useCreateApplication(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, body }: { namespace: string; body: AppCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const response = await applicationsApi(epinioClient).createApp(namespace, toApiAppCreateRequest(body));
            return response;
        },
        onSuccess: (response) => {
            epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id]})
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useUpdateApplication(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, body }: { namespace: string; app: string; body: AppUpdateRequest }): Promise<AppOperation | ApiResourceResponse> => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const response = await applicationsApi(epinioClient).updateApp(namespace, app, toApiAppUpdateRequest(body));
            return 'app' in response ? toAppOperation(response) : response;
        },
        onSuccess: (response) => {
            epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id]})
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useStoreApplicationArchive(store: any, onSuccessCallback?: (blobUid: string) => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, tarball }: { namespace: string; app: string; tarball: Blob }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const data = new FormData();
            data.append('file', tarball);
            const size = tarball.size.toString();
            return toAppStoreArchiveResponse(await applicationsApi(epinioClient).storeArchive(namespace, app, data, size));
        },
        onSuccess: (response) => {
            if (onSuccessCallback) {
                onSuccessCallback(response.blobUid);
            }
        },
    }, epinioQueryClient);
}

export function useBuildApplication(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, request }: { namespace: string; app: App; request: AppStageRequest; }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const response = await applicationsApi(epinioClient).stage(namespace, app.meta.name, toApiAppStageRequest(request));
            return toAppOperation(response);
        },
        onSuccess: () => {
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeployApplication(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, request }: { namespace: string; app: App; request: AppDeployRequest; }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const response = await applicationsApi(epinioClient).deploy(namespace, app.meta.name, toApiAppDeployRequest(request));
            return toAppOperation(response);
        },
        onSuccess: () => {
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}



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

    onError: () => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['applications', cluster.value?.id]
        });
    },

    onSuccess: () => {
        epinioQueryClient.invalidateQueries({
            queryKey: ['applications', cluster.value?.id]
        });

        if (onSuccessCallback) {
            onSuccessCallback();
        }
    },
  }, epinioQueryClient);
}