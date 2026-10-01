import { ref } from "vue";
import { BuildCache } from "./restage";
import { useCreateApplication, useUpdateApplication, useStoreApplicationArchive, useImportGitApplication, useBuildApplication, useDeployApplication } from "../../../queries/useApplicationMutations";
import { useBindConfiguration, useUnbindConfiguration } from "../../../queries/useConfigurationMutations";
import { useBindServiceInstance, useUnbindServiceInstance } from "../../../queries/useServiceMutations";
import { extractErrorMessage } from "../../../utils/errors";
import { AppForm, App, AppFormSource, AppMeta } from "../ui-types";
import { appFormToCreateRequest, appFormToUpdateRequest, appFormToAsyncDeployRequest, resolveGitParams } from "../mappers";
import { epinioQueryClient } from "../../../api/queryClient";
import { useCluster } from "../../../queries/useCluster";

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
  const { mutateAsync: importGit } = useImportGitApplication(store, updateBuildCacheBlobUid);
  const { mutateAsync: buildApp } = useBuildApplication(store);
  const { mutateAsync: deployApp } = useDeployApplication(store);
  const { mutateAsync: bindConfig } = useBindConfiguration(store);
  const { mutateAsync: unbindConfig } = useUnbindConfiguration(store);
  const { mutateAsync: bindService } = useBindServiceInstance(store);
  const { mutateAsync: unbindService } = useUnbindServiceInstance(store);

  async function run(params: {
    mode: 'create' | 'edit';
    form: AppForm;
    initialForm: AppForm;
    initialApp: App | null; // populated for edit
    // callbacks: {
    //   onStagingLog: (stageId: string) => void;
    //   onAppLog: () => void;
    // };
    isSourceDirty: boolean;
    isBindingsDirty: boolean;
  }) {
    const { mode, form, initialForm, initialApp, isSourceDirty, isBindingsDirty } = params;
    const { details, source, bindings } = form;
    const isEdit = mode === 'edit';

    app.value = initialApp;
    steps.value = buildSteps(mode, form, isSourceDirty, isBindingsDirty);
    running.value = true;
    failed.value = false;
    isDone.value = false;
    buildCache.value = {};

    if (!cluster?.value) {
      throw new Error('Cluster not found');
    }

    const stepRunner = makeStepRunner(steps.value);

    console.log('//// Running Application Pipeline ')
    try {
      // 1. Create or update app record
      if (!isEdit) {
        console.log('//// Creating Application: ', form);
        await stepRunner('create', async () => {
          const createdApp = await createApp({
            namespace: details.namespace,
            body:      appFormToCreateRequest(form),
          });
          app.value = createdApp;
        });
      } else {
        console.log('//// Updating Application: ', form);
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
        console.log('//// Binding Configurations: ', bindings.configurations);
        await stepRunner('bindConfigurations', () =>
          bindConfig({ namespace: details.namespace, appName: details.name, request: { names: bindings.configurations } })
        );
      } else if (isEdit) {
        console.log('//// Updating Configurations: ', {
          current: [...form.bindings.configurations, ...form.bindings.serviceConfigurations],
          initial: [...initialForm.bindings.configurations, ...initialForm.bindings.serviceConfigurations],
        });
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
        console.log('//// Binding Services: ', bindings.services);
        await stepRunner('bindServices', () =>
          Promise.all(bindings.services.map(name =>
            bindService({ namespace: details.namespace, serviceName: name, request: { appName: details.name } })
          ))
        );
      } else if (isEdit) {
        console.log('//// Updating Services: ', {
          current: bindings.services,
          initial: initialForm.bindings.services,
        });
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

      if (!isEdit || isSourceDirty) {
        console.log('//// Handling Source Changes: ', {
          current: source,
          initial: initialForm.source,
        });
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

        // 5. Git fetch
        if (source.type === 'gitUrl' || source.type === 'github' || source.type === 'gitlab') {
          console.log('//// Fetching Git Source');
          const { url, rev, gitConfig } = resolveGitParams(source);
          console.log('//// Resolved Git Params: ', { url, rev, gitConfig });
          await stepRunner('gitFetch', () =>
            importGit({ namespace: details.namespace, app: details.name, gitUrl: url, gitRev: rev, gitConfig })
          );
        }

        if (!app.value) {
          throw new Error('App is not available');
        }

        // 6. Build
        console.log('//// Building Application');
        const needsBuild = ['archive', 'folder', 'gitUrl', 'github', 'gitlab'].includes(source.type);
        if (needsBuild) {
          const request = appFormToAsyncDeployRequest(form, buildCache.value);
          console.log('//// Build App Variables: ', {
            namespace: details.namespace,
            app: app.value,
            request,
            buildCache: buildCache.value,
          });
          await stepRunner('build', () =>
            buildApp({
              namespace: details.namespace,
              app: app.value,
              request,
              buildCache: buildCache.value,
            })
          );
        }

        // 7. Deploy
        console.log('//// Deploying Application');
        const deployRequest = appFormToAsyncDeployRequest(form, buildCache.value);
        console.log('//// Deploy App Variables: ', {
          namespace: details.namespace,
          app: app.value,
          request: deployRequest,
          buildCache: buildCache.value,
        });
        await stepRunner('deploy', () =>
          deployApp({
            namespace: details.namespace,
            app: app.value,
            request: deployRequest,
            buildCache: buildCache.value,
          })
        );
      }

      console.log('//// App Deploy Done, Invalidating Queries for Applications');
      store.dispatch('growl/success', {
        title: params.mode === 'edit'
          ? t('epinio.growl.application.update.success.title')
          : t('epinio.growl.application.deploy.success.title'),
        message: params.mode === 'edit'
          ? t('epinio.growl.application.update.success.message', { name: form.details.name })
          : t('epinio.growl.application.deploy.success.message', { name: form.details.name }),
      });
      epinioQueryClient.invalidateQueries({ queryKey: ['applications', cluster.value.id] });
      isDone.value = true;
    } catch (err) {
      const errDetails = err instanceof Error ? err.message : String(err);
      failed.value = true;
      store.dispatch('growl/error', {
        title: params.mode === 'edit'
          ? t('epinio.growl.application.update.error.title')
          : t('epinio.growl.application.deploy.error.title'),
        message: params.mode === 'edit'
          ? t('epinio.growl.application.update.error.message', { name: form.details.name, error: errDetails })
          : t('epinio.growl.application.deploy.error.message', { name: form.details.name, error: errDetails }),
      });
      throw err;
    } finally {
      running.value = false;
    }
  }

  return { steps, running, failed, isDone, buildCache, run };
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
  } else if (isEdit) {
    steps.push(makeStep('updateConfigurations'));
  }

  // 3. Bind/unbind services
  if (!isEdit && bindings.services.length) {
    steps.push(makeStep('bindServices'));
  } else if (isEdit) {
    steps.push(makeStep('updateServices'));
  }

  // Source steps only when source is dirty or creating app
  if (!isEdit || isSourceDirty) {
    // 4. Upload archive/folder if needed
    if (isArchiveOrFolder) steps.push(makeStep('upload'));
    // 5. Git fetch if needed
    if (isGit) steps.push(makeStep('gitFetch'));
    // 6. Build if needed
    if (needsBuild) steps.push(makeStep('build'));
    // 7. Deploy (always last)
    steps.push(makeStep('deploy'));
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

