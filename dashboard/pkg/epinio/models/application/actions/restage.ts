import { App } from "../ui-types";
import { applicationsApi } from "../../../api/applications";
import { useCluster } from "../../../queries/useCluster";
import { createEpinioClient } from "../../../api/client";
import { AppUtils } from "../../../utils/application";
import { APPLICATION_SOURCE_TYPE, APPLICATION_MANIFEST_SOURCE_TYPE } from "../../../types";
import { toAppDeploymentStatus, toApiAsyncDeployRequest, toApiAppStageRequest, toAppStageResponse, toApp } from "../mappers";
import { AsyncDeployRequest, AppDeploymentStatus, AppStageRequest, AppMeta } from "../ui-types";
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
  deployMode?: 'sync' | 'async';
  asyncDeployDeploymentId?: string;
  stageForSync?: { stage: { id: string }; image: string };
  deployment?: AppDeploymentStatus;
  blobUid?: string;
  appMeta?: AppMeta;
}

// localStorage helpers
function asyncDeployStorageKey(namespace: string, name: string) {
  return `epinio.async-deploy.${namespace}.${name}`;
}
function persistAsyncDeploymentId(namespace: string, name: string, id: string) {
  try {
    localStorage.setItem(asyncDeployStorageKey(namespace, name), id);
  } catch (e) {
    console.error(e);
  }
}
function readPersistedAsyncDeploymentId(namespace: string, name: string): string | undefined {
  try {
    return localStorage.getItem(asyncDeployStorageKey(namespace, name)) || undefined;
  } catch {
    return undefined;
  }
}
function clearPersistedAsyncDeploymentId(namespace: string, name: string) {
  try {
    localStorage.removeItem(asyncDeployStorageKey(namespace, name));
  } catch (e) {
    console.error(e);
  }
}

export function retryDeployOrigin(app: App) {
  const origin     = app.origin || {};
  const sourceType = AppUtils.getSourceType(origin);

  if (sourceType === APPLICATION_SOURCE_TYPE.CONTAINER_URL) {
    return { Kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER, container: origin.container };
  }

  if (origin.git?.repository) {
    return {
      Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
      git: {
        repository: origin.git.repository,
        revision:   origin.git.revision,
        branch:     origin.git.branch,
        provider:   origin.git.provider,
        gitconfig:  origin.git.gitconfig,
      },
    };
  }

  if (origin.path) {
    return {
      Kind:    APPLICATION_MANIFEST_SOURCE_TYPE.PATH,
      path:    origin.path,
      archive: !!origin.archive,
    };
  }

  return origin;
}

async function getDeploymentStatus(api: ReturnType<typeof applicationsApi>, namespace: string, name: string, deploymentId: string) {
  const response = await api.fetchDeploymentStatus(namespace, name, deploymentId);
  return toAppDeploymentStatus(response);
}

// Deployment id extraction, I think this is unnecessary now as the id is not being overwritten by the shell
// function extractDeploymentIdFromLocation(location: string | undefined): string | undefined {
//   if (!location || typeof location !== 'string') return undefined;
//   const normalized = location.split('?')[0].replace(/\/+$/, '');
//   const parts = normalized.split('/');
//   return parts[parts.length - 1] || undefined;
// }

// export function extractDeploymentIdFromResponse(response: any, payload: any): string | undefined {
//   const headers  = response?._headers || response?.headers || {};
//   const location = headers?.location || headers?.Location;
//   const locationId = extractDeploymentIdFromLocation(location);
//   if (locationId) return locationId;

//   const fromPayload = payload?.id || payload?.deployment_id || payload?.deploymentId || payload?.status?.id;
//   if (fromPayload) return fromPayload;

//   return response?.id || response?.deployment_id;
// }

async function stage(
  api: ReturnType<typeof applicationsApi>,
  namespace: string,
  name: string,
  request: AppStageRequest,
  buildCache: BuildCache,
) {
  console.log('Staging app:', namespace, name, request);
  const apiResponse = await api.stage(namespace, name, toApiAppStageRequest(request));
  console.log('Staging response:', apiResponse);
  const result = toAppStageResponse(apiResponse);

  buildCache.stageForSync = { stage: result.stage, image: result.image };
  return result;
}

async function waitForStaging(
  api: ReturnType<typeof applicationsApi>,
  namespace: string,
  stageId: string,
  iteration = 0,
) {
  try {
    await api.waitForStaging(namespace, stageId);
  } catch (e: any) {
    if (e.status === 500 && iteration === 0) {
      await waitForStaging(api, namespace, stageId, 1);
    } else {
      throw e;
    }
  }
}

async function ensureAsyncDeployStarted(
  api: ReturnType<typeof applicationsApi>,
  namespace: string,
  name: string,
  request: AsyncDeployRequest,
  buildCache: BuildCache,
) {
  if (buildCache.deployMode === 'sync' || buildCache.asyncDeployDeploymentId) return;

  // Try to resume an in-flight deployment after UI reload
  const persistedId = readPersistedAsyncDeploymentId(namespace, name);
  if (persistedId) {
    try {
      await getDeploymentStatus(api, namespace, name, persistedId);
      buildCache.asyncDeployDeploymentId = persistedId;
      return;
    } catch {
      clearPersistedAsyncDeploymentId(namespace, name);
    }
  }

  let response: AppDeploymentStatus | undefined;
  let deploymentId: string | undefined;

  try {

    const apiResponse = await api.startAsyncDeploy(namespace, name, toApiAsyncDeployRequest(request));
    response = toAppDeploymentStatus(apiResponse);

    // const payload = response?.data ?? response;
    // deploymentId  = extractDeploymentIdFromResponse(response, payload);
    deploymentId = response?.id;
  } catch (e: any) {
    const status = e?.status || e?.errors?.[0]?.status;
    if ([404, 405, 500, 502, 503, 504].includes(status)) {
      buildCache.deployMode = 'sync';
      clearPersistedAsyncDeploymentId(namespace, name);
      return;
    }
    throw e;
  }

  if (!deploymentId) {
    buildCache.deployment = response;
    return;
  }

  buildCache.asyncDeployDeploymentId = deploymentId;
  buildCache.deployment              = response;
  persistAsyncDeploymentId(namespace, name, deploymentId);
}

async function pollDeploymentUntil(
  api: ReturnType<typeof applicationsApi>,
  // app: App,
  store: any,
  namespace: string,
  name: string,
  deploymentId: string,
  donePred: (s: any) => boolean,
  { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {},
) {
  const start = Date.now();
  let stagingLogShown = false;

  while (true) {
    const status = await getDeploymentStatus(api, namespace, name, deploymentId);

    if (status?.stageId && !stagingLogShown) {
      const fetchedApp = toApp(await api.getApp(namespace, name));
      console.log('PollDeploymentUntil: Fetched app for staging:', fetchedApp);
      showStagingLog(store, {...fetchedApp, stageId: status.stageId});
      stagingLogShown = true;
    }

    if (donePred(status) || status?.status === 'failed') return status;

    if (Date.now() - start > timeoutMs) {
      const err: any = new Error('Timed out waiting for deployment');
      err.status = status;
      throw err;
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }
}

async function waitForDeployment(
  api: ReturnType<typeof applicationsApi>,
  // app: App,
  store: any,
  namespace: string,
  name: string,
  deploymentId: string,
  clusterId: string,
  { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {},
) {
  const start = Date.now();
  let stagingLogShown = false;

  while (true) {
    const status = await getDeploymentStatus(api, namespace, name, deploymentId);

    if (status?.stageId && !stagingLogShown) {
      stagingLogShown = true;
      const fetchedApp = toApp(await api.getApp(namespace, name));
      console.log('WaitForDeployment: Fetched app for staging:', fetchedApp);
      showStagingLog(store, {...fetchedApp, stageId: status.stageId});
    }

    if (status?.status === 'succeeded') {
      clearPersistedAsyncDeploymentId(namespace, name);
      epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
      return status;
    }

    if (status?.status === 'failed') {
      clearPersistedAsyncDeploymentId(namespace, name);
      const err: any = new Error(status?.error || 'Deployment failed');
      err.status = status;
      throw err;
    }

    if (Date.now() - start > timeoutMs) {
      const err: any = new Error('Timed out waiting for deployment');
      err.status = status;
      throw err;
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }
}

async function waitForAppReadyOrError(
  api: ReturnType<typeof applicationsApi>,
  namespace: string,
  name: string,
  { timeoutMs = 20 * 60 * 1000, intervalMs = 2000 } = {},
) {
  const RUNNING = 'running';
  const ERROR   = 'error';
  const start   = Date.now();

  while (true) {
    const app = await api.getApp(namespace, name);

    if (app.status === RUNNING) return;
    if (app.status === ERROR) throw new Error(app.statusmessage || 'Deployment failed');
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for deployment');

    await new Promise(r => setTimeout(r, intervalMs));
  }
}

export async function waitAsyncBuildPhase(
  api: ReturnType<typeof applicationsApi>,
  // app: App,
  store: any,
  namespace: string,
  name: string,
  request: AsyncDeployRequest,
  buildCache: BuildCache,
  deploy?: boolean
) {
  const isContainer = request.origin?.Kind === APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER;
  if (isContainer) return;

  // If deploy is false, we only want to stage the app and not start the async deployment
  if (!deploy) {
    console.log('waitAsyncBuildPhase: deploy is false, only staging the app');
    const result = await stage(api, namespace, name, request, buildCache);
    if (result.stage?.id) {
      const fetchedApp = toApp(await api.getApp(namespace, name));
      showStagingLog(store, {...fetchedApp, stageId: result.stage.id});
      await waitForStaging(api, namespace, result.stage.id);
    }
    return;
  }

  // If deploy is true, we want to start the async deployment and wait for it to complete
  await ensureAsyncDeployStarted(api, namespace, name, request, buildCache);

  // If the deploy mode is set to sync during ensureAsyncDeployStarted, we need to stage the app and wait for it to complete
  if (buildCache.deployMode === 'sync') {
    const result = await stage(api, namespace, name, request, buildCache);
    if (!request.image) {
      throw new Error('Image is required for sync stage');
    }
    buildCache.stageForSync = { stage: result.stage, image: request.image };
    if (result.stage?.id) {
      const fetchedApp = toApp(await api.getApp(namespace, name));
      showStagingLog(store, {...fetchedApp, stageId: result.stage.id});
      await waitForStaging(api, namespace, result.stage.id);
    }
    return;
  }

  const id = buildCache.asyncDeployDeploymentId;
  if (!id) return; // accepted but no id, Do not fallback to sync build to avoid duplicate stage jobs

  const status = await pollDeploymentUntil(
    api, /* app, */ store, namespace, name, id,
    (s) => ['deploying', 'succeeded', 'failed'].includes(s.status),
  );

  if (status?.status === 'failed') {
    const err: any = new Error(status?.error || 'Build failed');
    err.status = status;
    throw err;
  }
}

export async function waitAsyncDeployPhase(
  api: ReturnType<typeof applicationsApi>,
  // app: App,
  store: any,
  namespace: string,
  name: string,
  request: AsyncDeployRequest,
  buildCache: BuildCache,
  clusterId: string,
) {
  await ensureAsyncDeployStarted(api, namespace, name, request, buildCache);

  if (buildCache.deployMode === 'sync') {
    if (!request.image) {
      throw new Error('Image is required for sync deploy');
    }
    await api.deploy(namespace, name, {
      app:    request.app,
      image:  request.image,
      origin: request.origin,
      stage: {
        id: buildCache.stageForSync?.stage?.id ?? '',
      },
    });
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId, namespace] });
    return;
  }

  const id = buildCache.asyncDeployDeploymentId;

  if (id) {
    await waitForDeployment(api, /* app, */ store, namespace, name, id, clusterId);
    return;
  }

  await waitForAppReadyOrError(api, namespace, name);
  clearPersistedAsyncDeploymentId(namespace, name);
  epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
}

export async function restartApp(
  store: any,
  app: App,
  api?: ReturnType<typeof applicationsApi>,
  namespace?: string,
  name?: string,
  clusterId?: string,
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

  try {
    namespace = namespace ?? app.meta.namespace;
    name = name ?? app.meta.name;

    if (!api || !clusterId) {
      const { data: fetchedCluster } = useCluster(store);

      if (!fetchedCluster.value) {
        throw new Error(t('epinio.growl.application.clusterUnavailable'));
      }

      clusterId = clusterId || fetchedCluster.value.id;

      if (!api) {
        const isExtension = !!store.getters['isSingleProduct'] === false;

        api = applicationsApi(createEpinioClient(fetchedCluster.value, isExtension));
      }
    }

    await api.restart(namespace, name);
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    showAppLog(store, app);
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
  }
}

/** Sync stage-only (CLI `app build`). Does not deploy. */
export async function stageAppOnly(
  api: ReturnType<typeof applicationsApi>,
  store: any,
  namespace: string,
  name: string,
  request: AppStageRequest,
  buildCache: BuildCache,
) {
  const result = await stage(api, namespace, name, request, buildCache);

  buildCache.stageForSync = { stage: result.stage, image: result.image || request.image || '' };

  if (result.stage?.id) {
    const fetchedApp = toApp(await api.getApp(namespace, name));

    showStagingLog(store, { ...fetchedApp, stageId: result.stage.id });
    await waitForStaging(api, namespace, result.stage.id);
  }

  return result;
}

function stageRequestFromApp(app: App): AppStageRequest {
  const { builder: builderImage, buildMode, dockerfilePath } = app.staging || {};

  return {
    app:            app.meta,
    blobUid:        app.blobUid || '',
    builderImage:   builderImage || '',
    buildMode:      buildMode || '',
    dockerfilePath: dockerfilePath || '',
    image:          app.imageUrl || '',
    origin:         app.origin,
  };
}

/**
 * Rebuild / stage. Never-deployed apps stage only (CLI `app build`);
 * deployed apps restage and restart when running. Deploy is a separate action.
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

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api, clusterId } = resolved;
    const { namespace, name } = app.meta;
    const buildCache: BuildCache = {};

    clearPersistedAsyncDeploymentId(namespace, name);

    await stageAppOnly(
      api, store, namespace, name, stageRequestFromApp(app), buildCache,
    );

    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    epinioQueryClient.invalidateQueries({ queryKey: ['application', clusterId, namespace, name] });

    if (app.deployment && app.status === 'running') {
      await restartApp(store, app, api, namespace, name, clusterId);
    }

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

  try {
    const resolved = resolveClusterClient(store);

    if (!resolved) {
      throw new Error(t('epinio.growl.application.clusterUnavailable'));
    }

    const { api, clusterId } = resolved;
    const { namespace, name } = app.meta;

    await api.deploy(namespace, name, {
      app:    app.meta,
      image:  app.builtImageUrl,
      origin: app.origin,
      stage:  { id: app.stageId },
    });

    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
    epinioQueryClient.invalidateQueries({ queryKey: ['application', clusterId, namespace, name] });

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