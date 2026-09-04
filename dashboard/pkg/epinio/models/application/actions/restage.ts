import { App } from "../ui-types";
import { applicationsApi } from "../../../api/applications";
import { useCluster } from "../../../queries/useCluster";
import { createEpinioClient } from "../../../api/client";
import { AppUtils } from "../../../utils/application";
import { APPLICATION_SOURCE_TYPE, APPLICATION_MANIFEST_SOURCE_TYPE } from "../../../types";
import { toAppDeploymentStatus, toApiAsyncDeployRequest, toApiAppStageRequest, toAppStageResponse } from "../mappers";
import { AsyncDeployRequest, AppDeploymentStatus, AppStageRequest, AppStageResponse, AppDeployRequest } from "../ui-types";
import { epinioQueryClient } from "../../../api/queryClient";
import { showAppLog, showStagingLog } from "./logs";

interface BuildCache {
  deployMode?:              'sync' | 'async';
  asyncDeployDeploymentId?: string;
  stageForSync?:            { stage: { id: string }; image: string };
  deployment?:              AppDeploymentStatus;
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
  const apiResponse = await api.stage(namespace, name, toApiAppStageRequest(request));
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
  app: App,
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
      stagingLogShown = true;
      showStagingLog(store, {...app, stageId: status.stageId});
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
  app: App,
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
      showStagingLog(store, {...app, stageId: status.stageId});
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

async function waitAsyncBuildPhase(
  api: ReturnType<typeof applicationsApi>,
  app: App,
  store: any,
  namespace: string,
  name: string,
  request: AsyncDeployRequest,
  buildCache: BuildCache,
) {
  const isContainer = request.origin?.Kind === APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER;
  if (isContainer) return;

  await ensureAsyncDeployStarted(api, namespace, name, request, buildCache);

  if (buildCache.deployMode === 'sync') {
    const result = await stage(api, namespace, name, request, buildCache);
    buildCache.stageForSync = { stage: result.stage, image: request.image };
    if (result.stage?.id) {
      showStagingLog(store, {...app, stageId: result.stage.id});
      await waitForStaging(api, namespace, result.stage.id);
    }
    return;
  }

  const id = buildCache.asyncDeployDeploymentId;
  if (!id) return; // accepted but no id, Do not fallback to sync build to avoid duplicate stage jobs

  const status = await pollDeploymentUntil(
    api, app, store, namespace, name, id,
    (s) => ['deploying', 'succeeded', 'failed'].includes(s.status),
  );

  if (status?.status === 'failed') {
    const err: any = new Error(status?.error || 'Build failed');
    err.status = status;
    throw err;
  }
}

async function waitAsyncDeployPhase(
  api: ReturnType<typeof applicationsApi>,
  app: App,
  store: any,
  namespace: string,
  name: string,
  request: AsyncDeployRequest,
  buildCache: BuildCache,
  clusterId: string,
) {
  await ensureAsyncDeployStarted(api, namespace, name, request, buildCache);

  if (buildCache.deployMode === 'sync') {
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
    await waitForDeployment(api, app, store, namespace, name, id, clusterId);
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

  store.dispatch('growl/info', {
    title:   t('epinio.growl.application.restart.info.title'),
    message: t('epinio.growl.application.restart.info.message'),
  });

  let cluster = null;
  if (!clusterId) {
    const { data: fetchedCluster } = useCluster(store);
    if (!fetchedCluster.value) {
      throw new Error('Cluster is not available');
    }
    cluster = fetchedCluster.value;
    clusterId = cluster.id;
  }

  if (!clusterId || !cluster) {
    throw new Error('Cluster is not available');
  }

  namespace = namespace ?? app.meta.namespace;
  name = name ?? app.meta.name;

  if (!api) {
    const isExtension       = !!store.getters['isSingleProduct'] === false;
    const client            = createEpinioClient(cluster, isExtension);
    api = applicationsApi(client);
  }

  try {
    await api.restart(namespace, name);
    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId ?? cluster.id ] });
    showAppLog(store, app);
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
  }
}

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

  const clusterId         = cluster.value.id;

  const isExtension       = !!store.getters['isSingleProduct'] === false;
  const client            = createEpinioClient(cluster.value, isExtension);
  const api               = applicationsApi(client);
  const { namespace, name } = app.meta;
  const buildCache: BuildCache = {};

  try {
    // Never-deployed / failed first push: stage + deploy using stored blob or git.
    // Already-deployed apps: restage only (optionally restart when running).
    if (!app.deployment) {
      clearPersistedAsyncDeploymentId(namespace, name);
      await waitAsyncDeployPhase(
        api, app, store, namespace, name,
        {
          app:          app.meta,
          blobUid:      app.blobUid || '',
          builderImage: app.staging.builder || '',
          origin:       app.origin,
          buildMode:    app.staging.buildMode || '',
          dockerfilePath: app.staging.dockerfilePath || '',
          image:        app.imageUrl || '',
        },
        buildCache,
        clusterId,
      );

      epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });

      if (app.stageId) showStagingLog(store, app);
    } else {
      // Already-deployed app, restage only, then restart if running
      const { builder: builderImage, buildMode, dockerfilePath } = app.staging || {};
      const { stage: stageResult } = await stage(
        api, namespace, name,
        {
            builderImage: builderImage || '', 
            buildMode: buildMode || '', 
            dockerfilePath: dockerfilePath || '', 
            app: app.meta, blobUid: app.blobUid || '', 
            image: app.imageUrl || '' },
        buildCache,
      );

      epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });
      showStagingLog(store, {...app, stageId: stageResult.id});
      await waitForStaging(api, namespace, stageResult.id);

      if (app.status === 'running') {
        await restartApp(store, app, api, namespace, name, clusterId);
      }
    }

    epinioQueryClient.invalidateQueries({ queryKey: ['applications', clusterId] });

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
  }
}