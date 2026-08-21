import { useQuery, keepPreviousData, queryOptions } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { servicesApi } from "../api/services";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListServiceInstancesResponse, toServiceInstance } from "../models/service/mappers";

export function useServices(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['services', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const services = await servicesApi(epinioClient).listServices(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListServiceInstancesResponse(services);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

function serviceQueryOptions(
  cluster: any,
  isExtension: boolean,
  namespace: string,
  serviceName: string,
) {
  return queryOptions({
    queryKey: ['service', cluster?.id, namespace, serviceName],
    queryFn: async () => {
      if (!cluster) {
        throw new Error('Cluster is not available');
      }
      const epinioClient = createEpinioClient(cluster, isExtension);
      return await servicesApi(epinioClient).getService(namespace, serviceName);
    },
    enabled: !!cluster,
  });
}

export function useService(store: any, namespace: string, serviceName: string) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        ...serviceQueryOptions(cluster.value, isExtension.value, namespace, serviceName),
        queryKey: computed(() => ['service', cluster.value?.id, namespace, serviceName]),
        enabled: computed(() => !!cluster.value),
        placeholderData: keepPreviousData,
        refetchInterval: 10000,
        structuralSharing: false, // disable to ensure age updates in the ui
    }, epinioQueryClient);
}

export async function fetchService(store: any, namespace: string, serviceName: string) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    const apiService = await epinioQueryClient.fetchQuery(
        serviceQueryOptions(cluster.value, isExtension.value, namespace, serviceName)
    );
    return toServiceInstance(apiService);
}