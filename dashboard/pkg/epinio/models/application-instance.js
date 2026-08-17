import Resource from '@shell/plugins/dashboard-store/resource-class';
import { openTab } from '../utils/dock-state';

export default class ApplicationInstanceResource extends Resource {
  get _availableActions() {
    const canGetter = this.$rootGetters?.['epinio/can'];
    const perms = this.$rootGetters?.['epinio/permissions']?.();

    // If permissions are not loaded yet, hide Shell (API will still enforce RBAC if somehow called)
    if (!canGetter || !perms || Object.keys(perms).length === 0) {
      return [];
    }

    const canExec = canGetter('app_exec');

    if (!canExec) {
      // view_only / read-only roles don't get the Shell action
      return [];
    }

    return [{
      action:  'showAppShell',
      label:   this.t('epinio.applications.actions.onlyShell.label'),
      icon:    'icon icon-fw icon-chevron-right',
      enabled: this.ready,
    }];
  }

  get state() {
    switch (this.ready) {
    case true:
      return 'ready';
    case false:
      return 'notready';
    default:
      return 'pending';
    }
  }

  showAppShell() {
    try {
      openTab({
        id:        `epinio-${ this.application.id }-app-shell`,
        label:     `${ this.application.meta.name } - App Shell`,
        icon:      'chevron-right',
        component: 'ApplicationShell',
        props:     {
          application:     this.application,
          endpoint:        this.application.linkFor('shell'),
          initialInstance: this.name,
        }
      });
    } catch (e) {
      console.log(e);
      this.$dispatch('growl/error', {
        title:   this.t('epinio.growl.application.shell.error.title'),
        message: this.t('epinio.growl.application.shell.error.message'),
      }, { root: true });
    }
  }
}
