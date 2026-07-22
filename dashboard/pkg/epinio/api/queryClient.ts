import { QueryClient } from "@tanstack/vue-query";
// Module-scope singleton — created once when this file is first imported,
// independent of any Vue app lifecycle. No app.use() needed.
// TO-DO: remove once app is bootstrapped as a typical vue app
export const epinioQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export const epinioKeys = {
  namespaces: (clusterId: string) => ['epinio', clusterId, 'namespaces'] as const,
  namespace:  (clusterId: string, name: string) => ['epinio', clusterId, 'namespaces', name] as const,
};