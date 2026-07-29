import type { EpinioRole } from '../types';

// Mapping from Epinio role IDs to the action IDs they imply.
// These should stay in sync with the server-side role definitions.
const ROLE_ACTIONS: Record<string, string[]> = {
  // Default "Epinio User Role" when backend returns id "user" (e.g. RBAC not yet applied).
  // Treat as read-only so Create/Edit stay hidden until server sends proper roles (e.g. view_only).
  user: [
    'namespace_read',
    'app_read',
    'app_logs',
    'configuration_read',
    'service_read',
    'gitconfig_read',
    'export_registries_read',
    'chart_read',
    'builderimage_read',
    'gitconfig_read',
  ],

  // Read-only role
  view_only: [
    'namespace_read',
    'app_read',
    'app_logs',
    'configuration_read',
    'service_read',
    'gitconfig_read',
    'export_registries_read',
    'chart_read',
    'builderimage_read',
    'gitconfig_read',
  ],

  // Application Developer: create/update applications but no delete or non-app writes
  application_developer: [
    'namespace_read',
    'namespace_write',
    'app_read',
    'app_logs',
    'app_create',
    'app_update',
    'app_scale',
    'app_update_env',
    'app_update_configs',
    'app_update_routes',
    'app_update_settings',
    'app_update_chart',
    'app_stage',
    'app_deploy',
    'app_export',
    'configuration_read',
    'configuration_write',
    'service_write',
    'chart_read',
    'chart_write',
    'builderimage_read',
    'builderimage_write',
    'gitconfig_read',
    'gitconfig_write',
  ],

  // Application Manager: full app CRUD and runtime operations, no non-app writes
  application_manager: [
    'namespace_read',
    'namespace_write',
    'app_read',
    'app_logs',
    'app_create',
    'app_update',
    'app_scale',
    'app_update_env',
    'app_update_configs',
    'app_update_routes',
    'app_update_settings',
    'app_update_chart',
    'app_stage',
    'app_deploy',
    'app_export',
    'app_delete',
    'app_restart',
    'app_exec',
    'app_portforward',
    'configuration_read',
    'configuration_write',
    'service_write',
    'chart_read',
    'chart_write',
    'builderimage_read',
    'builderimage_write',
    'gitconfig_read',
    'gitconfig_write',
  ],

  // System Manager: no-delete role, app create/update/runtime plus read-only on other resources
  system_manager: [
    'namespace_read',
    'namespace_write',
    'app_read',
    'app_logs',
    'app_create',
    'app_update',
    'app_scale',
    'app_update_env',
    'app_update_configs',
    'app_update_routes',
    'app_update_settings',
    'app_update_chart',
    'app_stage',
    'app_deploy',
    'app_export',
    'app_restart',
    'app_exec',
    'app_portforward',
    'configuration_read',
    'configuration_write',
    'service_read',
    'service_write',
    'gitconfig_read',
    'export_registries_read',
    'chart_read',
    'chart_write',
    'builderimage_read',
    'builderimage_write',
    'catalog_service_read',
    'catalog_service_write',
    'gitconfig_read',
    'gitconfig_write',
  ],
};

// Actions only the admin role has (server-side admin can create/delete namespaces; other roles cannot).
const ADMIN_ONLY_ACTIONS = ['namespace_write', 'namespace'];

// Actions the server authorizes against GLOBAL (namespace-less) roles only,
// because they act on cluster-scoped resources whose routes carry no :namespace:
// app charts (/appcharts), builder images (/builderimages), git configs
// (/gitconfigs). Server-side, User.IsAllowed resolves these against global roles,
// so a namespace-scoped role must NOT grant them. Without this, the default
// "epinio" user's admin:workspace role flattens into the global map and the UI
// shows a Create button the server then 403s. This mirrors the isAdmin getter's
// fix. NB: the git-config "global" checkbox is a separate admin-only concern,
// already gated by isAdmin in GitConfigModal.vue.
const CLUSTER_SCOPED_ACTIONS = ['chart_write', 'builderimage_write', 'gitconfig_write'];

// Union of all actions for the admin role – effectively "everything".
const ADMIN_ACTIONS = Array.from(
  new Set<string>([...Object.values(ROLE_ACTIONS).flat(), ...ADMIN_ONLY_ACTIONS]),
);

export type EpinioPermissions = Record<string, boolean>;

/**
 * Normalize role ID so both "application_developer" and "epinio-role-application-developer" map correctly.
 * ConfigMaps may use id equal to the short name or the full ConfigMap name.
 */
function normalizeRoleId(id: string): string {
  if (!id) return id;
  // epinio-role-application-developer -> application_developer
  if (id.startsWith('epinio-role-')) {
    return id.slice('epinio-role-'.length).replace(/-/g, '_');
  }
  return id;
}

/**
 * Build a flat permission map from the list of roles returned by /api/v1/me.
 * Keys are action IDs (e.g. "app_create", "namespace_write"), values are booleans.
 */
export function buildPermissionsFromRoles(roles: EpinioRole[]): EpinioPermissions {
  const actions = new Set<string>();
  // Actions granted specifically by global (namespace-less) roles. Cluster-scoped
  // actions are sourced from here so a namespaced role cannot grant them.
  const globalActions = new Set<string>();

  for (const role of roles || []) {
    const roleId = normalizeRoleId(role.id || '');
    const isGlobal = !role.namespace;

    const add = (a: string) => {
      actions.add(a);
      if (isGlobal) {
        globalActions.add(a);
      }
    };

    if (roleId === 'admin') {
      ADMIN_ACTIONS.forEach(add);
      continue;
    }

    // Prefer actions returned by the server (/api/v1/me). Fall back to the
    // hardcoded ROLE_ACTIONS map only when the server didn't send any —
    // i.e. older Epinio versions that don't include role.actions.
    if (Array.isArray(role.actions) && role.actions.length > 0) {
      role.actions.forEach(add);
      continue;
    }

    const mapped = ROLE_ACTIONS[roleId] || [];
    mapped.forEach(add);
  }

  const perms: EpinioPermissions = {};

  actions.forEach((a) => {
    perms[a] = true;
  });

  // Cluster-scoped actions are valid only when a global role granted them.
  // Override any that leaked in via a namespaced role (e.g. admin:workspace).
  CLUSTER_SCOPED_ACTIONS.forEach((a) => {
    perms[a] = globalActions.has(a);
  });

  // Catalog services are cluster-scoped too, but the server authorizes them via
  // the mixed service_write action (which also grants namespaced service-instance
  // writes) rather than a dedicated one. Derive the UI-only catalog_service_write
  // from GLOBAL service_write so a namespaced service_write cannot grant catalog
  // management. The catalog list/detail components gate on catalog_service_write.
  perms.catalog_service_write = globalActions.has('service_write');

  // namespace_write is also mixed: NamespaceCreate (POST /namespaces) is
  // cluster-scoped, but per-namespace delete (DELETE /namespaces/:namespace) is
  // namespaced. Derive a global-only create permission so a namespaced admin does
  // not see the create-namespace button; per-namespace delete stays on the flat
  // namespace_write. The namespaces list gates create on namespace_create.
  perms.namespace_create = globalActions.has('namespace_write');

  return perms;
}

