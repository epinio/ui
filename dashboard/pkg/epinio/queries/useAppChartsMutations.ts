import { useMutation } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { appChartsApi } from "../api/appcharts";
import { epinioQueryClient } from "../api/queryClient";
import { computed } from "vue";
import { AppChartCreateRequest, AppChartUpdateRequest } from "../models/appcharts/ui-types";
import { toApiAppChartCreateRequest, toApiAppChartUpdateRequest } from "../models/appcharts/mappers";

export function useCreateAppChart(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);


    return useMutation({
        mutationFn: async ({ request }: { request: AppChartCreateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await appChartsApi(epinioClient).createAppChart(toApiAppChartCreateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['appcharts', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}   

export function useUpdateAppChart(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name, request }: { name: string, request: AppChartUpdateRequest }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await appChartsApi(epinioClient).updateAppChart(name, toApiAppChartUpdateRequest(request));
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['appcharts', cluster.value?.id] });
            epinioQueryClient.invalidateQueries({ queryKey: ['appchart', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}

export function useDeleteAppChart(store: any, onSuccessCallback?: () => void) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            return await appChartsApi(epinioClient).deleteAppChart(name);
        },
        onSuccess: () => {
            epinioQueryClient.invalidateQueries({ queryKey: ['appcharts', cluster.value?.id] });
            if (onSuccessCallback) {
                onSuccessCallback();
            }
        },
    }, epinioQueryClient);
}
