import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { applicationsApi } from "../api/applications";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { AppDeleteRequest, App, AppCreateRequest, AppUpdateRequest, AsyncDeployRequest, AppMeta } from "../models/application/ui-types";
import { toApiAppDeleteRequest, toApiAppCreateRequest, toApiAppUpdateRequest, toAppStoreArchiveResponse, toAppGitImportResponse, toApp } from "../models/application/mappers";
import { waitAsyncDeployPhase, waitAsyncBuildPhase, BuildCache } from "../models/application/actions/restage";

export function useCreateApplication(store: any, onSuccessCallback?: (appMeta: AppMeta) => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, body }: { namespace: string; body: AppCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            await applicationsApi(epinioClient).createApp(namespace, toApiAppCreateRequest(body));
            return toApp(await applicationsApi(epinioClient).getApp(namespace, body.name));
        },
        onSuccess: (response) => {
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback(response.meta);
            }
        },
    }, epinioQueryClient);
}

export function useUpdateApplication(store: any, onSuccessCallback?: (appMeta: AppMeta) => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, body }: { namespace: string; app: string; body: AppUpdateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            await applicationsApi(epinioClient).updateApp(namespace, app, toApiAppUpdateRequest(body));
            return toApp(await applicationsApi(epinioClient).getApp(namespace, app));
        },
        onSuccess: (response) => {
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback(response.meta);
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
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback(response.blobUid);
            }
        },
    }, epinioQueryClient);
}

export function useImportGitApplication(store: any, onSuccessCallback?: (blobUid: string) => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ namespace, app, gitUrl, gitRev, gitConfig }: { namespace: string; app: string; gitUrl?: string; gitRev?: string; gitConfig?: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            if (!gitUrl) {
                throw new Error('Git URL is required');
            }
            if (!gitRev) {
                throw new Error('Git revision is required');
            }
            console.log('//// Import Git Parameters: ', {
              gitUrl,
              gitRev,
              gitConfig,
            });
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const data = new FormData();
            data.append('giturl', gitUrl);
            data.append('gitrev', gitRev );
            if (gitConfig) {
                data.append('gitconfig', gitConfig);
            }
            console.log('//// Import Git FormData: ', {
              FormData: data.get('giturl') && data.get('gitrev') ? Object.fromEntries(data.entries()) : null
            });
            return toAppGitImportResponse(await applicationsApi(epinioClient).importGit(namespace, app, data)); 
        },
        onSuccess: (response) => {
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
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
        mutationFn: async ({ namespace, app, request, buildCache }: { namespace: string; app: App; request: AsyncDeployRequest; buildCache: BuildCache}) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await waitAsyncBuildPhase(applicationsApi(epinioClient), /* app, */ store, namespace, app.meta.name, request, buildCache);
        },
        onSuccess: () => {
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
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
        mutationFn: async ({ namespace, app, request, buildCache }: { namespace: string; app: App; request: AsyncDeployRequest; buildCache: BuildCache}) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await waitAsyncDeployPhase(applicationsApi(epinioClient), /* app, */ store, namespace, app.meta.name, request, buildCache, cluster.value?.id);
        },
        onSuccess: () => {
            // epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id] });
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