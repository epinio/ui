interface UserRole {
    id: string;
    name: string;
    namespace?: string;
    default?: boolean;
    actions?: string[];
}

export type UserPermissions = Record<string, boolean>;

export interface User {
    user: string;
    roles: UserRole[];
    namespaces: string[];
    gitConfigs: string[];
    permissions: UserPermissions;
}