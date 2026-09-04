import { openTab } from "../../../utils/dock-state";
import { App } from "../ui-types";
  
export function showAppShell(store: any, app: App) {
    const t = store.getters['i18n/t']
    try {
        const initialInstance = Object.keys(app.deployment.replicas)[0];
        if (!initialInstance) {
            throw new Error('No running instances available');
        }
        openTab({
            id:        `epinio-${app.meta.namespace}/$${app.meta.name}-app-shell`,
            label:     `${ app.meta.name } - App Shell`,
            icon:      'chevronRight',
            component: 'ApplicationShell',
            props:     {
                application:     app,
                endpoint:        `/wapi/v1/namespaces/${app.meta.namespace}/applications/${app.meta.name}/exec?tty=true`,
                initialInstance: initialInstance,
            }
        });
    } catch (e) {
        console.log(e);
        store.dispatch('growl/error', {
            title:   t('epinio.growl.application.shell.error.title'),
            message: t('epinio.growl.application.shell.error.message'),
        }, { root: true });
    }
}