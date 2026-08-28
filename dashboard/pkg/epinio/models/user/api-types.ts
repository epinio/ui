interface ApiUserRole {
    id: string;
    name: string;
    namespace?: string;
    default?: boolean;
    actions?: string[];
}

export interface ApiUser {
    user: string;
    roles: ApiUserRole[];
    namespaces: string[];
    gitconfigs: string[];
}
