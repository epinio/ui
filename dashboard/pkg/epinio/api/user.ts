import { createEpinioClient } from "./client";
import { ApiUser } from "models/user/api-types";
    
export function userApi(epinioClient: ReturnType<typeof createEpinioClient>) {
    const appChartsBasePath = '/api/v1/me';

    return {
        getUser: async (): Promise<ApiUser> => {
            return await epinioClient.get(appChartsBasePath);
        },
    };
}