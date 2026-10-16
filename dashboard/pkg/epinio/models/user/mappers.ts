import type { ApiUser } from "./api-types";
import type { User } from "./ui-types";
import { buildPermissionsFromRoles } from "../../utils/permissions";

export function toUser(apiUser: ApiUser): User {
    return {
        user: apiUser.user,
        roles: apiUser.roles.map(role => ({
            id: role.id,
            name: role.name,
            namespace: role.namespace,
            default: role.default,
            actions: role.actions,
        })),
        namespaces: apiUser.namespaces,
        gitConfigs: apiUser.gitconfigs,
        permissions: buildPermissionsFromRoles(apiUser.roles),
    };
}