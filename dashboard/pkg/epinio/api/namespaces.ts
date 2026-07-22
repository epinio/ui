import { createEpinioClient } from "./client";

export function namespacesApi(epinioClient: ReturnType<typeof createEpinioClient>) {

    return {
        listNamespaces: async () => {
            return await epinioClient.get('/api/v1/namespaces');
        },
        createNamespace: async (name: string) => {
            return await epinioClient.post('/api/v1/namespaces', { name });
        },
        deleteNamespace: async (name: string) => {
            return await epinioClient.delete(`/api/v1/namespaces/${name}`);
        }
    };
}