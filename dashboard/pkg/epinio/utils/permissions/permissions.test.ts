import { buildPermissionsFromRoles } from './permissions';

const role = (id: string, extra: Record<string, any> = {}) => ({ id, name: id, ...extra });

describe('buildPermissionsFromRoles', () => {
  it('returns only derived flags (all false) for no roles', () => {
    const perms = buildPermissionsFromRoles([]);

    expect(Object.values(perms).every((v) => v === false)).toBe(true);
    expect(buildPermissionsFromRoles(null as any)).toEqual(perms);
  });

  it('grants everything to a global admin', () => {
    const perms = buildPermissionsFromRoles([role('admin')]);

    expect(perms.app_delete).toBe(true);
    expect(perms.namespace).toBe(true);
    expect(perms.chart_write).toBe(true);
    expect(perms.catalog_service_write).toBe(true);
    expect(perms.namespace_create).toBe(true);
  });

  it('withholds cluster-scoped actions from a namespaced admin', () => {
    const perms = buildPermissionsFromRoles([role('admin', { namespace: 'workspace' })]);

    expect(perms.app_delete).toBe(true);
    expect(perms.namespace_write).toBe(true);
    expect(perms.chart_write).toBe(false);
    expect(perms.builderimage_write).toBe(false);
    expect(perms.gitconfig_write).toBe(false);
    expect(perms.catalog_service_write).toBe(false);
    expect(perms.namespace_create).toBe(false);
  });

  it('still grants cluster-scoped actions when a global role also has them', () => {
    const perms = buildPermissionsFromRoles([
      role('admin', { namespace: 'workspace' }),
      role('application_manager'),
    ]);

    expect(perms.chart_write).toBe(true);
  });

  it('falls back to the hardcoded map when the server sends no actions', () => {
    const perms = buildPermissionsFromRoles([role('view_only')]);

    expect(perms.app_read).toBe(true);
    expect(perms.app_create).toBeUndefined();
  });

  it('prefers server-sent actions over the hardcoded map', () => {
    const perms = buildPermissionsFromRoles([role('view_only', { actions: ['app_create'] })]);

    expect(perms.app_create).toBe(true);
    expect(perms.app_read).toBeUndefined();
  });

  it('normalizes ConfigMap-style role ids', () => {
    const perms = buildPermissionsFromRoles([role('epinio-role-application-manager')]);

    expect(perms.app_delete).toBe(true);
  });

  it('treats the default user role as read-only', () => {
    const perms = buildPermissionsFromRoles([role('user')]);

    expect(perms.app_read).toBe(true);
    expect(perms.app_create).toBeUndefined();
    expect(perms.app_delete).toBeUndefined();
  });

  it('grants nothing for an unknown role', () => {
    const perms = buildPermissionsFromRoles([role('mystery')]);

    expect(Object.values(perms).some(Boolean)).toBe(false);
  });

  it('derives catalog_service_write from global service_write only', () => {
    expect(buildPermissionsFromRoles([role('custom', { actions: ['service_write'] })]).catalog_service_write).toBe(true);
    expect(buildPermissionsFromRoles([role('custom', { namespace: 'ws', actions: ['service_write'] })]).catalog_service_write).toBe(false);
  });
});
