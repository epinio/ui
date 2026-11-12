import { App } from "../ui-types";
import { applicationsApi } from "../../../api/applications";
import { useCluster } from "../../../queries/useCluster";
import { createEpinioClient } from "../../../api/client";
import { toAppState, appToAppDeployRequest } from "../mappers";
import {  AppMeta } from "../ui-types";
import { epinioQueryClient } from "../../../api/queryClient";
import { showAppLog, showStagingLog } from "./logs";

export interface BuildCache {
  blobUid?: string;
  appMeta?: AppMeta;
}

// wait for an operation to complete, polling the app state until the operation is done or failed
async function waitForOperation(
  api: ReturnType<typeof applicationsApi>, namespace: string, name: string,
  operationId: string,
  opts: { onStageId?: (stageId: string) => void; timeoutMs?: number; intervalMs?: number } = {},
) {
  const { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = opts;
  const start = Date.now();
  let stageIdReported = false;
  let consecutiveErrors = 0;

  while (true) {
    try {
      const state = toAppState(await api.state(namespace, name));
      consecutiveErrors = 0;

      // if the app has a stageId and we haven't reported it yet, call the onStageId callback
      if (state.stageId && !stageIdReported) {
        stageIdReported = true;
        opts.onStageId?.(state.stageId);
      }
      if (state.operation?.id === operationId && state.operation?.phase === 'succeeded') return state;
      if (state.status === 'error') throw new Error(state.statusMessage || 'Operation failed');
    } catch (e) {
      if (++consecutiveErrors >= 3) throw e;   // tolerate up to 2 consecutive errors, then give up
    }

    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for operation');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// restart an app by calling the restart API and waiting for the operation to complete
export async function restartApp(
  store: any,
  app: App,
) {
  const t = store.getters['i18n/t'];

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.restart.info.title'),
    message: t('epinio.growl.application.restart.info.message'),
  });

  const { data: cluster } = useCluster(store);

  if (!cluster.value) {
    throw new Error('Cluster is not available');
  }
  
  const isExtension       = !!store.getters['isSingleProduct'] === false;
  const client            = createEpinioClient(cluster.value, isExtension);
  const api               = applicationsApi(client);
  const { namespace, name } = app.meta;

  try {
    const response = await api.restart(namespace, name);
    showAppLog(store, app);
    await waitForOperation(api, namespace, name, response.id);
    
    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.restart.success.title'),
      message: t('epinio.growl.application.restart.success.message', { name }),
    });
  } catch (e) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restart.error.title'),
      message: t('epinio.growl.application.restart.error.message'),
    });
  } finally {
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id ] });
  }
}

// restage an app by calling the deploy API with the same source and waiting for the operation to complete
export async function restageApp(
  store: any,
  app: App,
) {
  const t = store.getters['i18n/t'];

  if (!app.canRetryBuild) {
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restage.error.title'),
      message: 'No reusable source available to rebuild',
    });
    return;
  }

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.restage.info.title'),
    message: t('epinio.growl.application.restage.info.message'),
  });

  const { data: cluster } = useCluster(store);

  if (!cluster.value) {
    throw new Error('Cluster is not available');
  }

  const isExtension       = !!store.getters['isSingleProduct'] === false;
  const client            = createEpinioClient(cluster.value, isExtension);
  const api               = applicationsApi(client);
  const { namespace, name } = app.meta;

  try {
    const response = await api.deploy(namespace, name, appToAppDeployRequest(app, true));
    await waitForOperation(api, namespace, name, response.id, { onStageId: (id) => showStagingLog(store, {...app, stageId: id}) });

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.restage.success.title'),
      message: t('epinio.growl.application.restage.success.message', { name }),
    });
  } catch (e: any) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restage.error.title'),
      message: e?.message || t('epinio.growl.application.restage.error.message'),
    });
  } finally {
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value?.id ] });
  }
}