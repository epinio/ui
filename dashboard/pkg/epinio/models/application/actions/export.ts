
import { App } from "../ui-types";
import { downloadFile } from "../../../utils/download";
import { applicationsApi } from "../../../api/applications";
import { APPLICATION_PARTS } from "../../../types";
import { AppExportCancelMap } from "../ui-types";
import JSZip from "jszip";
import { useCluster } from "../../../queries/useCluster";
import { createEpinioClient } from "../../../api/client";
import { computed } from "vue";

export async function fetchApplicationPart(store: any, namespace: string, app: string, part: string, signal?: AbortSignal) {
    const { data: cluster } = useCluster(store);
    const isExtension = computed(() => !!store.getters['isSingleProduct'] === false);

    if (!cluster.value) {
        throw new Error('Cluster is not available');
    }

    const epinioClient = createEpinioClient(cluster.value, isExtension.value);

    return applicationsApi(epinioClient).fetchPart(namespace, app, part, signal);
}

export async function createManifest(store: any, app: App) {
    const t = store.getters['i18n/t'];
    try {
        const date = new Date().toISOString().split('.')[0];
        const fileName = `${ app.meta.namespace }-${ app.meta.name }-${ date }.yaml`;

        const manifest = await fetchApplicationPart(store, app.meta.namespace, app.meta.name, 'manifest');

        await downloadFile(fileName, manifest, 'application/yaml');
    } catch (e) {
        console.log(e);
        store.dispatch('growl/error', {
            title:   t('epinio.growl.application.manifest.error.title'),
            message: t('epinio.growl.application.manifest.error.message'),
        }, { root: true });
        throw e;
    }
}

export async function fetchPartWithProgress(
  store: any,
  namespace: string,
  appName: string,
  part: string,
  onStart: () => void,
  onDone: () => void,
  signal?: AbortSignal
): Promise<any> {
  onStart();

  const data = await fetchApplicationPart(
    store,
    namespace,
    appName,
    part,
    signal
  );

  signal?.throwIfAborted();

  onDone();

  return data;
}

export async function exportChartAndImages(
  store: any,
  app: App,
  onStep: (step: string | null, isPreparing?: boolean) => void,
  cancelMap: AppExportCancelMap
): Promise<void> {
  const { namespace, name } = app.meta;

  // Try server-side archive first
  const archiveController = new AbortController();
  cancelMap['archive'] = archiveController;
  onStep('archive', true);
  try {
    const archiveBlob = await fetchApplicationPart(store, namespace, name, 'archive', archiveController.signal);
    archiveController.signal.throwIfAborted();
    if (archiveBlob) {
      onStep('archive');
      await downloadFile(`${name}-helm-chart.zip`, archiveBlob, 'application/zip');
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
        throw e;
    }
    // backend doesn't support archive endpoint, fall through to client-side zip
  } finally {
    delete cancelMap['archive'];
  }

  // Client-side zip fallback — fetch all three parts
  const parts = [APPLICATION_PARTS.VALUES, APPLICATION_PARTS.CHART, APPLICATION_PARTS.IMAGE];
  const extensions: Record<string, string> = {
    [APPLICATION_PARTS.VALUES]: 'yaml',
    [APPLICATION_PARTS.CHART]:  'tar.gz',
    [APPLICATION_PARTS.IMAGE]:  'tar',
  };

  const partsData: Record<string, any> = {};

  for (const part of parts) {
    const partController = new AbortController();
    cancelMap[part] = partController;
    try {
        partsData[part] = await fetchPartWithProgress(
            store,
            namespace,
            name,
            part,
            () => onStep(part, true),
            () => {
                onStep(part);
            },
            partController.signal
        ); 
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw e;
      }
    } finally {
      delete cancelMap[part];
    }
  }

  if (Object.values(partsData).some(p => !p)) {
    throw new Error('One or more export parts could not be downloaded');
  }

  onStep('zip');

  const zip = new JSZip();
  for (const [fileName, data] of Object.entries(partsData)) {
    zip.file(`${fileName}.${extensions[fileName]}`, data);
  }

  const contents = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  await downloadFile(`${name}-helm-chart.zip`, contents, 'application/zip');
}