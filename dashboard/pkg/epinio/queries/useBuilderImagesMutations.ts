import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { builderImagesApi } from "../api/builderimages";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { BuilderImageCreateRequest, BuilderImageUpdateRequest } from "../models/builderimage/ui-types";
import { toApiBuilderImageCreateRequest, toApiBuilderImageUpdateRequest } from "../models/builderimage/mappers";

export function useCreateBuilderImage(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ request }: { request: BuilderImageCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await builderImagesApi(epinioClient).createBuilderImage(toApiBuilderImageCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['builderimages', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useUpdateBuilderImage(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name, request }: { name: string, request: BuilderImageUpdateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await builderImagesApi(epinioClient).updateBuilderImage(name, toApiBuilderImageUpdateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['builderimages', cluster.value?.id] });
            epinioQueryClient.invalidateQueries({ queryKey: ['appchart', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeleteBuilderImage(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await builderImagesApi(epinioClient).deleteBuilderImage(name);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['builderimages', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}
