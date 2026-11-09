import { ref, computed, watch } from "vue";
import { BuildCache } from "./restage";
import { useCreateApplication, useUpdateApplication, useStoreApplicationArchive, useBuildApplication, useDeployApplication } from "../../../queries/useApplicationMutations";
import { useBindConfiguration, useUnbindConfiguration } from "../../../queries/useConfigurationMutations";
import { useBindServiceInstance, useUnbindServiceInstance } from "../../../queries/useServiceMutations";
import { extractErrorMessage } from "../../../utils/errors";
import { AppForm, App, AppMeta } from "../ui-types";
import { appFormToCreateRequest, appFormToUpdateRequest, appFormToAppStageRequest, appFormToAppDeployRequest } from "../mappers";
import { epinioQueryClient } from "../../../api/queryClient";
import { useCluster } from "../../../queries/useCluster";
import { FormState } from "../form/useAppForm";
import { useApplicationState } from "../../../queries/useApplicationQueries";
import { showStagingLog } from "./logs";
import { ResourceQueryOptions } from "../../../models/resource/ui-types";

export type StepState = 'pending' | 'running' | 'success' | 'fail';
export interface PipelineStep {
  action: string;
  state: StepState;
  stateMessage?: string;
}

export function useAppPipeline(store: any) {
  const steps = ref<PipelineStep[]>([]);
  const running = ref(false);
  const failed = ref(false);
  const isDone = ref(false);
  const buildCache = ref<BuildCache>({});
  const app = ref<App | null>(null);
  const appName = computed(() => app.value?.meta.name || '');
  const appNamespace = computed(() => app.value?.meta.namespace || '');
  const hasAppBeenCreated = ref(false);
  const showedStagingLog = ref(false);

  const t = store.getters['i18n/t'];

  function updateBuildCacheBlobUid(blobUid: string) {
    buildCache.value.blobUid = blobUid;
  }

  function updateBuildCacheAppMeta(appMeta: AppMeta) {
    buildCache.value.appMeta = appMeta;
  }

  const { data: cluster } = useCluster(store);

  const { mutateAsync: createApp } = useCreateApplication(store, updateBuildCacheAppMeta);
  const { mutateAsync: updateApp } = useUpdateApplication(store, updateBuildCacheAppMeta);
  const { mutateAsync: storeArchive } = useStoreApplicationArchive(store, updateBuildCacheBlobUid);
  const { mutateAsync: buildApp } = useBuildApplication(store);
  const { mutateAsync: deployApp } = useDeployApplication(store);
  const { mutateAsync: bindConfig } = useBindConfiguration(store);
  const { mutateAsync: unbindConfig } = useUnbindConfiguration(store);
  const { mutateAsync: bindService } = useBindServiceInstance(store);
  const { mutateAsync: unbindService } = useUnbindServiceInstance(store);

  const stateQueryOptions = ref<ResourceQueryOptions>({ enabled: false, polling: true, isTablePagination: false });

  const { data: appState } = useApplicationState(store, appNamespace, appName, stateQueryOptions);

  // Watch for a stageId to appear on the appState, and if it does, show the staging log
  watch(appState, (newState) => {
    if (newState?.stageId && app.value && !showedStagingLog.value) {
      showStagingLog(store, {...app.value, stageId: newState.stageId});
      showedStagingLog.value = true;
    }
  });

  // Wait for the app to reach a desired state, with a 5 mintimeout
  const waitForState = async (operationId: string, timeout: number = 300000) => {
    const startTime = Date.now();
    stateQueryOptions.value.enabled = true;

    while (Date.now() - startTime < timeout) {
      if (appState.value?.operation?.id === operationId && appState.value?.operation?.phase === 'succeeded') {
        stateQueryOptions.value.enabled = false;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    stateQueryOptions.value.enabled = false;
    throw new Error(`Timeout waiting for app to reach state after ${timeout} ms`);
  };

  async function run(params: {
    mode: 'create' | 'edit';
    form: AppForm;
    state: FormState;
    initialForm: AppForm;
    initialApp: App | null; // populated for edit
  }) {
    const { mode, form, initialForm, initialApp, state } = params;
    const { details, source, bindings } = form;
    const isEdit = mode === 'edit';

    app.value = initialApp;
    steps.value = buildSteps(mode, form, state.source.dirty.value, state.bindings.dirty.value);
    running.value = true;
    failed.value = false;
    isDone.value = false;
    buildCache.value = {};
    hasAppBeenCreated.value = isEdit;
    showedStagingLog.value = false;

    if (!cluster?.value) {
      throw new Error('Cluster not found');
    }

    const stepRunner = makeStepRunner(steps.value);

    try {
      // 1. Create or update app record
      if (!isEdit) {
        await stepRunner('create', async () => {
          const createdApp = await createApp({
            namespace: details.namespace,
            body:      appFormToCreateRequest(form),
          });
          app.value = createdApp;
          hasAppBeenCreated.value = true;
        });
      } else {
        await stepRunner('update', async () => {
          const updatedApp = await updateApp({
            namespace: details.namespace,
            app:       details.name,
            body:      appFormToUpdateRequest(form, false, app.value?.status === 'running' && !!app.value.imageUrl),
          });
          app.value = updatedApp;
        });
      }

      // 2. Bind configurations (create only)
      if (bindings.configurations.length && !isEdit) {
        await stepRunner('bindConfigurations', () =>
          bindConfig({ namespace: details.namespace, appName: details.name, request: { names: bindings.configurations } })
        );
      } else if (isEdit && state.bindings.dirty.value) {
        await stepRunner('updateConfigurations', async () => {
          const currentConfigs = [...form.bindings.configurations, ...form.bindings.serviceConfigurations];
          const initialConfigs = [...initialForm.bindings.configurations, ...initialForm.bindings.serviceConfigurations];

          const bindConfigs = currentConfigs.filter(name => !initialConfigs.includes(name));
          const unbindConfigs = initialConfigs.filter(name => !currentConfigs.includes(name));

          if (bindConfigs.length) {
            await bindConfig({ namespace: details.namespace, appName: details.name, request: { names: bindConfigs } })
          }

          if (unbindConfigs.length) {
            await Promise.all(unbindConfigs.map(name =>
              unbindConfig({ namespace: details.namespace, appName: details.name, configName: name })
            ));
          }
        });
      }

      // 3. Bind services (create only)
      if (bindings.services.length && !isEdit) {
        await stepRunner('bindServices', () =>
          Promise.all(bindings.services.map(name =>
            bindService({ namespace: details.namespace, serviceName: name, request: { appName: details.name } })
          ))
        );
      } else if (isEdit && state.bindings.dirty.value) {
        await stepRunner('updateServices', async () => {
          const currentServices = form.bindings.services;
          const initialServices = initialForm.bindings.services;

          const bindServices = currentServices.filter(name => !initialServices.includes(name));
          const unbindServices = initialServices.filter(name => !currentServices.includes(name));

          if (bindServices.length) {
            await Promise.all(bindServices.map(name =>
              bindService({ namespace: details.namespace, serviceName: name, request: { appName: details.name } })
            ));
          }

          if (unbindServices.length) {
            await Promise.all(unbindServices.map(name =>
              unbindService({ namespace: details.namespace, serviceName: name, request: { appName: details.name } })
            ));
          }
        });
      }

      if (!isEdit || state.source.dirty.value) {
        // 4. Upload
        if (source.type === 'archive' || source.type === 'folder') {
          const tarball = source.type === 'archive' ? source.archive!.tarball : source.folder!.tarball;
          if (!tarball) {
            throw new Error(`Tarball not found for source type: ${source.type}`);
          }
          await stepRunner('upload', () =>
            storeArchive({ namespace: details.namespace, app: details.name, tarball })
          );
        }

        // 5. Build
        const needsBuild = ['archive', 'folder', 'gitUrl', 'github', 'gitlab'].includes(source.type) && !form.buildOptions.deploy;
        if (needsBuild) {
          const request = appFormToAppStageRequest(form, {blobUid: buildCache.value.blobUid, createdAt: app.value?.meta?.createdAt});
          await stepRunner('build', async () => {
            if (!app.value) {
              throw new Error('App is not available');
            }
            
            const response = await buildApp({
              namespace: details.namespace,
              app: app.value,
              request,
            });

            await waitForState(response.id, 300000); 
          });
          
        }

        // 6. Deploy
        else {
          const request = appFormToAppDeployRequest(form, {blobUid: buildCache.value.blobUid, createdAt: app.value?.meta?.createdAt, stageId: app.value?.stageId});
          await stepRunner('deploy', async () => {
            if (!app.value) {
              throw new Error('App is not available');
            }
            
            const response = await deployApp({
              namespace: details.namespace,
              app: app.value,
              request,
            });

            await waitForState(response.id, 300000);
          });
          
        }
        
      }

      store.dispatch('growl/success', {
        title: params.mode === 'edit'
          ? t('epinio.growl.application.update.success.title')
          : form.buildOptions.deploy 
          ? t('epinio.growl.application.deploy.success.title')
          : t('epinio.growl.application.build.success.title'),
        message: params.mode === 'edit'
          ? t('epinio.growl.application.update.success.message', { name: form.details.name })
          : form.buildOptions.deploy 
          ? t('epinio.growl.application.deploy.success.message', { name: form.details.name })
          : t('epinio.growl.application.build.success.message', { name: form.details.name }),
      });
      epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value.id] });
      isDone.value = true;
    } catch (err) {
      const errDetails = err instanceof Error ? err.message : String(err);
      failed.value = true;
      store.dispatch('growl/error', {
        title: params.mode === 'edit'
          ? t('epinio.growl.application.update.error.title')
          : form.buildOptions.deploy
          ? t('epinio.growl.application.deploy.error.title')
          : t('epinio.growl.application.build.error.title'),
        message: params.mode === 'edit'
          ? t('epinio.growl.application.update.error.message', { name: form.details.name, error: errDetails })
          : form.buildOptions.deploy
          ? t('epinio.growl.application.deploy.error.message', { name: form.details.name, error: errDetails })
          : t('epinio.growl.application.build.error.message', { name: form.details.name, error: errDetails }),
      });
      throw err;
    } finally {
      running.value = false;
    }
  }

  return { steps, running, failed, isDone, buildCache, hasAppBeenCreated, run };
}

// Finds the step and updates its state, then runs the executor
function makeStepRunner(steps: PipelineStep[]) {
  return async (action: string, executor: () => Promise<any>) => {
    const step = steps.find(s => s.action === action);
    if (!step) return;

    step.state = 'running';
    try {
      const result = await executor();
      step.state = 'success';
      return result;
    } catch (err: any) {
      step.state        = 'fail';
      step.stateMessage = extractErrorMessage(err);
      throw err;
    }
  };
}

function buildSteps(mode: 'create' | 'edit', form: AppForm, isSourceDirty: boolean, isBindingsDirty: boolean): PipelineStep[] {
  const { source, bindings } = form;
  const isEdit = mode === 'edit';

  const isArchiveOrFolder = ['archive', 'folder'].includes(source.type);
  const isGit = ['gitUrl', 'github', 'gitlab'].includes(source.type);
  const needsBuild = isArchiveOrFolder || isGit;

  const steps: PipelineStep[] = [];

  // 1. Create or update
  if (!isEdit) {
    steps.push(makeStep('create'));
  } else {
    steps.push(makeStep('update'));
  }

  // 2. Bind/unbind configurations
  if (!isEdit && bindings.configurations.length) {
    steps.push(makeStep('bindConfigurations'));
  } else if (isEdit && isBindingsDirty) {
    steps.push(makeStep('updateConfigurations'));
  }

  // 3. Bind/unbind services
  if (!isEdit && bindings.services.length) {
    steps.push(makeStep('bindServices'));
  } else if (isEdit && isBindingsDirty) {
    steps.push(makeStep('updateServices'));
  }

  // Source steps only when source is dirty or creating app
  if (!isEdit || isSourceDirty) {
    // 4. Upload archive/folder if needed
    if (isArchiveOrFolder) steps.push(makeStep('upload'));
    // 5. Build if needed
    if (needsBuild && !form.buildOptions.deploy) steps.push(makeStep('build'));
    // 6. Deploy (always last)
    else steps.push(makeStep('deploy'));
  }

  return steps;
}

function makeStep(action: string): PipelineStep {
  return {
    action,
    state:        'pending',
    stateMessage: undefined,
  };
}

