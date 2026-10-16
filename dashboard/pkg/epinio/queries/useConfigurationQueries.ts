import { useQuery, keepPreviousData, queryOptions } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { configurationsApi } from "../api/configurations";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListConfigurationsResponse, toConfigurationResponse } from "../models/configuration/mappers";

export function useConfigurations(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['configurations', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const configurations = await configurationsApi(epinioClient).listConfigurations(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListConfigurationsResponse(configurations);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

export function useNamespacedConfigurations(store: any, namespace: string, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['namespacedConfigurations', cluster.value?.id, namespace, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const configurations = await configurationsApi(epinioClient).listNamespacedConfigurations(namespace, params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListConfigurationsResponse(configurations);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: options.value.isTablePagination ? keepPreviousData : undefined,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

function configurationQueryOptions(
  cluster: any,
  isExtension: boolean,
  namespace: string,
  configName: string,
) {
  return queryOptions({
    queryKey: ['configuration', cluster?.id, namespace, configName],
    queryFn: async () => {
      if (!cluster) {
        throw new Error('Cluster is not available');
      }
      const epinioClient = createEpinioClient(cluster, isExtension);
      const apiConfiguration = await configurationsApi(epinioClient).getConfiguration(namespace, configName);
      return toConfigurationResponse(apiConfiguration);
    },
    enabled: !!cluster,
  });
}

export function useConfiguration(store: any, namespace: string, configName: string) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        ...configurationQueryOptions(cluster.value, isExtension.value, namespace, configName),
        queryKey: computed(() => ['configuration', cluster.value?.id, namespace, configName]),
        enabled: computed(() => !!cluster.value),
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}

export async function fetchConfiguration(store: any, namespace: string, configName: string) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    const configuration = await epinioQueryClient.fetchQuery(
        configurationQueryOptions(cluster.value, isExtension.value, namespace, configName)
    );
    return configuration;
}