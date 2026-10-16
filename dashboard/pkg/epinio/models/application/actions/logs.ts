import { openTab } from "../../../utils/dock-state";
import { App } from "../ui-types";

export function showAppLog(store: any, app: App) {
    const t = store.getters['i18n/t']
    try {
        openTab({
            id:        `epinio-${ app.meta.namespace }/${ app.meta.name }-app-logs`,
            label:     `${ app.meta.name } - App Logs`,
            icon:      'file',
            component: 'ApplicationLogs',
            props:     {
                application: app,
                endpoint:    `/wapi/v1/namespaces/${app.meta.namespace}/applications/${app.meta.name}/logs`
            }
        });
    } catch (e) {
        console.log(e);
        store.dispatch('growl/error', {
            title:   t('epinio.growl.application.appLogs.error.title'),
            message: t('epinio.growl.application.appLogs.error.message'),
        }, { root: true });
    }
}

export function showStagingLog(store: any, app: App) {
    const t = store.getters['i18n/t'];
    const stageId = app.stageId
    if (!stageId) {
        store.dispatch('growl/error', {
            title:   t('epinio.growl.application.buildLogs.noInfo.title'),
            message: t('epinio.growl.application.buildLogs.noInfo.message', { name: app.meta.name }),
        }, { root: true });

        return;
    }

    try {
        openTab({
        id:        `epinio-${ app.meta.namespace }/${ app.meta.name }-logs-${ stageId }`,
        label:     `${ app.meta.name } - Build - ${ stageId }`,
        icon:      'file',
        component: 'ApplicationLogs',
        props:     {
            application: app,
            endpoint:    `/wapi/v1/namespaces/${app.meta.namespace}/staging/${stageId}/logs`,
            ansiToHtml:  true
        }
        });
    } catch (e) {
        console.log(e);
        store.dispatch('growl/error', {
            title:   t('epinio.growl.application.buildLogs.error.title'),
            message: t('epinio.growl.application.buildLogs.error.message'),
        }, { root: true });
    }
}