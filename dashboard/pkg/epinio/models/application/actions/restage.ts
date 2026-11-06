import { App } from "../ui-types";
import { applicationsApi } from "../../../api/applications";
import { useCluster } from "../../../queries/useCluster";
import { createEpinioClient } from "../../../api/client";
import { toApiAppStageRequest, toApiAppDeployRequest, toAppState, appToAppDeployRequest } from "../mappers";
import { AppStageRequest, AppMeta } from "../ui-types";
import { epinioQueryClient } from "../../../api/queryClient";
import { showAppLog, showStagingLog } from "./logs";
import { extractErrorMessage } from "../../../utils/errors";

function extractActionErrorMessage(err: any, fallback: string, t?: (key: string) => string): string {
  const message = extractErrorMessage(err) || fallback;

  // Friendlier copy for the common undeployed / never-built case.
  if (t && /cannot deploy app without imageURL/i.test(message)) {
    return t('epinio.growl.application.deployBuild.error.noImage');
  }

  return message || fallback;
}

function resolveClusterClient(store: any) {
  const { data: cluster } = useCluster(store);

  if (!cluster.value) {
    return null;
  }

  const isExtension = !!store.getters['isSingleProduct'] === false;

  return {
    clusterId: cluster.value.id,
    api:       applicationsApi(createEpinioClient(cluster.value, isExtension)),
  };
}

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
      if (state.operation?.id === operationId && state.operation?.phase === 'failed') {
        throw new Error(state.operation.error || state.statusMessage || 'Operation failed');
      }
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

  // Create/build-only apps have nothing to restart — fail before the info growl.
  if (!app.imageUrl || app.status !== 'running') {
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restart.error.title'),
      message: !app.imageUrl
        ? t('epinio.growl.application.deployBuild.error.noImage')
        : t('epinio.growl.application.restart.error.noInstances'),
    });
    return;
  }

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.restart.info.title'),
    message: t('epinio.growl.application.restart.info.message'),
  });

  let clusterId: string | undefined;

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api } = resolved;
    const { namespace, name } = app.meta;

    clusterId = resolved.clusterId;

    const response = await api.restart(namespace, name);

    showAppLog(store, app);
    await waitForOperation(api, namespace, name, response.id);

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.restart.success.title'),
      message: t('epinio.growl.application.restart.success.message', { name }),
    });
  } catch (e: any) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restart.error.title'),
      message: extractActionErrorMessage(e, t('epinio.growl.application.restart.error.message'), t),
    });
  } finally {
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
  }
}

function stageRequestFromApp(app: App): AppStageRequest {
  const { builder: builderImage, buildMode, dockerfilePath } = app.staging || {};

  return {
    app:            app.meta,
    blobUid:        app.blobUid || '',
    builderImage:   builderImage || '',
    buildMode:      buildMode || '',
    dockerfilePath: dockerfilePath || '',
    origin:         app.origin,
  };
}

/**
 * Rebuild / stage. Never-deployed apps stage only (CLI `app build`) and are not deployed;
 * deployed apps are restaged and redeployed in one deploy operation (without an image or stage id).
 * Deploying a never-deployed app is a separate action (see `deployBuiltApp`).
 */
export async function restageApp(
  store: any,
  app: App,
) {
  const t = store.getters['i18n/t'];

  if (!app.canRetryBuild) {
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restage.error.title'),
      message: t('epinio.growl.application.restage.error.noSource'),
    });
    return;
  }

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.restage.info.title'),
    message: t('epinio.growl.application.restage.info.message'),
  });

  let clusterId: string | undefined;
  let namespace: string | undefined;
  let name: string | undefined;

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api } = resolved;

    clusterId = resolved.clusterId;
    ({ namespace, name } = app.meta);

    const onStageId = (stageId: string) => showStagingLog(store, { ...app, stageId });

    const response = app.deployment
      ? await api.deploy(namespace, name, toApiAppDeployRequest(appToAppDeployRequest(app, true)))
      : await api.stage(namespace, name, toApiAppStageRequest(stageRequestFromApp(app)));

    await waitForOperation(api, namespace, name, response.id, { onStageId });

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.restage.success.title'),
      message: t('epinio.growl.application.restage.success.message', { name }),
    });
  } catch (e: any) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.restage.error.title'),
      message: extractActionErrorMessage(e, t('epinio.growl.application.restage.error.message'), t),
    });
  } finally {
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    if (namespace && name) {
      epinioQueryClient.invalidateQueries({ queryKey: ['application', clusterId, namespace, name] });
    }
  }
}

/** Deploy the app's last staged image without building (CLI `app deploy`). */
export async function deployBuiltApp(store: any, app: App) {
  const t = store.getters['i18n/t'];

  if (!app.builtImageUrl || !app.stageId) {
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.deployBuild.error.title'),
      message: t('epinio.growl.application.deployBuild.error.noBuild'),
    });
    return;
  }

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.deployBuild.info.title'),
    message: t('epinio.growl.application.deployBuild.info.message'),
  });

  let clusterId: string | undefined;
  const { namespace, name } = app.meta;

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api } = resolved;

    clusterId = resolved.clusterId;

    const response = await api.deploy(namespace, name, toApiAppDeployRequest({
      app:    app.meta,
      image:  app.builtImageUrl,
      origin: app.origin,
      stage:  { id: app.stageId },
    }));

    await waitForOperation(api, namespace, name, response.id);

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.deployBuild.success.title'),
      message: t('epinio.growl.application.deployBuild.success.message', { name }),
    });
  } catch (e: any) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.deployBuild.error.title'),
      message: extractActionErrorMessage(e, t('epinio.growl.application.deployBuild.error.message'), t),
    });
  } finally {
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    epinioQueryClient.invalidateQueries({ queryKey: ['application', clusterId, namespace, name] });
  }
}

/** Delete staged build artifacts without deleting the application. */
export async function deleteAppBuild(store: any, app: App) {
  const t = store.getters['i18n/t'];

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.deleteBuild.info.title'),
    message: t('epinio.growl.application.deleteBuild.info.message'),
  });

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api, clusterId } = resolved;
    const { namespace, name } = app.meta;

    await api.deleteBuild(namespace, name);

    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    epinioQueryClient.invalidateQueries({ queryKey: ['application', clusterId, namespace, name] });

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.deleteBuild.success.title'),
      message: t('epinio.growl.application.deleteBuild.success.message', { name }),
    });
  } catch (e: any) {
    console.error(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.deleteBuild.error.title'),
      message: extractActionErrorMessage(e, t('epinio.growl.application.deleteBuild.error.message'), t),
    });
  }
}
