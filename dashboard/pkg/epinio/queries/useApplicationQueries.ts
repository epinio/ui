import { useQuery, keepPreviousData, queryOptions } from "@tanstack/vue-query";
import { createEpinioClient } from "../api/client";
import { useCluster } from "./useCluster";
import { applicationsApi } from "../api/applications";
import { epinioQueryClient } from "../api/queryClient";
import { computed, Ref } from "vue";
import { ListResourceRequestParams, ResourceQueryOptions } from "../models/resource/ui-types";
import { toApiListResourceRequestParams } from "../models/resource/mappers";
import { toListAppsResponse } from "../models/application/mappers";

export function useApplications(store: any, params: Ref<ListResourceRequestParams>, options: Ref<ResourceQueryOptions>) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    return useQuery({
        queryKey: computed(() => ['applications', cluster.value?.id, params?.value]),
        queryFn: async () => {
            if (!cluster?.value) {
                throw new Error('Cluster is not available');
            }
            const epinioClient = createEpinioClient(cluster.value, isExtension.value);
            const apps = await applicationsApi(epinioClient).listApps(params ? toApiListResourceRequestParams(params.value) : undefined);
            return toListAppsResponse(apps);
        },
        enabled: computed(() => !!cluster.value && options.value.enabled),
        placeholderData: keepPreviousData,
        refetchInterval: options.value.polling ? 10000 : false,
        structuralSharing: options.value.polling ? false : true, // disable to ensure age updates in the ui when polling tables
    }, epinioQueryClient);
}

// function applicationPartOptions(
//   cluster: any,
//   isExtension: boolean,
//   namespace: string,
//   app: string,
//   part: string,
//   signal?: AbortSignal
// ) {
//   return queryOptions({
//     queryKey: ['application-part', cluster?.id, namespace, app, part],
//     queryFn: async () => {
//       if (!cluster) {
//         throw new Error('Cluster is not available');
//       }
//       const epinioClient = createEpinioClient(cluster, isExtension);
//       return await applicationsApi(epinioClient).fetchPart(namespace, app, part, signal);
//     },
//     enabled: !!cluster,
//   });
// }

// export async function fetchApplicationPart(store: any, namespace: string, app: string, part: string, signal?: AbortSignal) {
//     const { data: cluster } = useCluster(store);
//     const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

//     const apiPart = await epinioQueryClient.fetchQuery(
//         applicationPartOptions(cluster.value, isExtension.value, namespace, app, part, signal)
//     );
//     return apiPart;
// }