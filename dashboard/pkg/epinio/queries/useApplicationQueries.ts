import { useQuery, keepPreviousData } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { applicationsApi } from "../api/applications";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListAppsResponse, toApp, toAppState } from "../models/application/mappers";
import { AppListMode } from "../models/application/ui-types";

export function useApplications(
    store: any,
    params: Ref<ListResourceRequestParams>,
    options: Ref<ResourceQueryOptions>,
    listMode?: Ref<AppListMode>,
) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);
    // Callers that omit listMode (bind modals, etc.) keep the deployed list.
    const mode = computed<AppListMode>(() => listMode?.value ?? 'deployed');

    return useQuery({
        // Keep clusterId as the 2nd key segment so existing
        // invalidateQueries(['applications', clusterId]) still matches both modes.
        queryKey: computed(() => ['applications', cluster.value?.id, mode.value, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const api = applicationsApi(epinioClient);
            const apiParams = params ? toApiListResourceRequestParams(params.value) : undefined;
            const apps = mode.value === 'undeployed'
                ? await api.listUndeployedApps(apiParams)
                : await api.listApps(apiParams);
            return toListAppsResponse(apps);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

export function useApplication(store: any, namespace: string, app: string, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['application', cluster.value?.id, namespace, app]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const appData = await applicationsApi(epinioClient).getApp(namespace, app);
            return toApp(appData);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true,
    }, epinioQueryClient);
}

export function useApplicationState(store: any, namespace: Ref<string | undefined>, app: Ref<string | undefined>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['application-state', cluster.value?.id, namespace, app]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            if (!namespace.value || !app.value) {
                throw new Error('Namespace or app name is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const appState = await applicationsApi(epinioClient).state(namespace.value, app.value);
            return toAppState(appState);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 2000 : false,
        structuralSharing: options.value.polling ? false : true,
    }, epinioQueryClient);
}