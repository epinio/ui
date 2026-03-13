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
  ],
};

// Actions only the admin role has (server-side admin can create/delete namespaces; other roles cannot).
const ADMIN_ONLY_ACTIONS = ['namespace_write', 'namespace'];

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

  for (const role of roles || []) {
    const roleId = normalizeRoleId(role.id || '');

    if (roleId === 'admin') {
      ADMIN_ACTIONS.forEach((a) => actions.add(a));
      continue;
    }

    const mapped = ROLE_ACTIONS[roleId] || [];
    mapped.forEach((a) => actions.add(a));
  }

  const perms: EpinioPermissions = {};

  actions.forEach((a) => {
    perms[a] = true;
  });

  return perms;
}

