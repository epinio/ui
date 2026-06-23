<script setup lang="ts">
import { useStore } from 'vuex'
import { ref, computed } from 'vue';

import JSZip from 'jszip';

import { APPLICATION_PARTS } from '../types';
import Banner from '@components/Banner/Banner.vue';
import { downloadFile } from '@shell/utils/download';
import Tabs from '../components/application/Tabs.vue';
import EpinioApplicationModel from 'models/applications';

const store = useStore();
const t = store.getters['i18n/t'];

const showModal = ref(false);
const activeTab = ref<string | number>('manifest')
const tabs = ref([
  { id: 'manifest', label: 'Manifest', completed: false, valid: false, disabled: false },
  { id: 'chartAndImages', label: 'Chart and Images', completed: false, valid: false, disabled: false },
]);
const showProgressBar = ref<boolean>(false);
const step = ref<any>(null);
const cancelTokenSources:object = {};
const resources = ref<Array<EpinioApplicationModel>>([]);
const exporting = ref<boolean>(false);
const errors = ref<Array<string>>([]);

const zipParts = computed(() =>
  resources.value[0]?.applicationParts.filter(
    (part) => part !== APPLICATION_PARTS.MANIFEST
  ) || []
);

function openExport(newResources: Array<EpinioApplicationModel>) {
  resources.value = newResources;
  showModal.value = true;
}

const exportApplicationManifest = async () => {
  exporting.value = true;
  enableDownload();
  const resource = resources.value[0];
  let exportSucceeded = false;

  try {
    const chartZip = async(files) => {
      const zip = new JSZip();

      for (const fileName in files) {
        const extension = {
          [APPLICATION_PARTS.VALUES]: 'yaml',
          [APPLICATION_PARTS.CHART]:  'tar.gz',
          [APPLICATION_PARTS.IMAGE]:  'tar',
        };

        zip.file(`${ fileName }.${ extension[fileName] }`, files[fileName]);
      }

      const contents = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });

      await downloadFile(
        `${ resource.meta.name }-helm-chart.zip`,
        contents,
        'application/zip',
      );
    };

    if (activeTab.value === 'manifest') {
      await resource.createManifest();
    } else {
      // Prefer server-side archive (one download, no client zip) when backend supports it
      const archiveBlob = await fetchPartArchive(resource);
      if (archiveBlob) {
        await downloadFile(
          `${ resource.meta.name }-helm-chart.zip`,
          archiveBlob,
          'application/zip',
        );
        await delayBeforeClose(1500);
      } else {
        // Fallback: fetch three parts and zip in browser (slower, especially in Rancher extension)
        const partsData = await zipParts.value.reduce(async(acc, part) => ({
          ...await acc,
          [part]: await fetchPart(resource, part),
        }), Promise.resolve({}));

        if (Object.values(partsData).some((part) => !part)) {
          throw new Error('One or more export parts could not be downloaded');
        }

        toggleStep('zip');

        await chartZip(partsData);

        await delayBeforeClose(1500);
      }
    }

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.export.success.title'),
      message: t('epinio.growl.application.export.success.message', { name: resource.meta.name }),
    });
    exportSucceeded = true;
  } catch (error) {
    const message = error.message ?? 'Error exporting application';

    errors.value.push(message);
    disableDownload();
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.export.error.title'),
      message: t('epinio.growl.application.export.error.message'),
    });
  } finally {
    exporting.value = false;
    if (exportSucceeded) {
      closeExport();
    }
  }


}

const getCancelToken = () => {
  return store.$axios.CancelToken;
}

// Fetches server-side archive (one zip). Returns blob or null if backend does not support it.
const fetchPartArchive = async (resource) => {
  toggleStep('archive', true);
  cancelTokenSources.archive = getCancelToken().source();
  try {
    const blob = await resource.fetchPart('archive', {
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.loaded > 0) {
          toggleStep('archive');
        }
      },
      cancelToken: cancelTokenSources.archive?.token,
    });
    return blob;
  } catch {
    return null;
  }
};

const fetchPart = async (resource, part) => {
  toggleStep(part, true);
  cancelTokenSources[part] = getCancelToken().source();

  return await resource.fetchPart(
    part, {
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.loaded > 0) {
          toggleStep(part);
        }
      },
      cancelToken: cancelTokenSources[part].token
    }).catch((thrown) => {
      if (!store.$axios.isCancel(thrown)) {
        disableDownload();

        // Override only messages of server errors
        const message = thrown.message ?? t(
          'epinio.applications.export.chartValuesImages.error', 
          { part },
        );

        throw new Error(message);
      }
    }
  );
}

const fetchCancel = () => {
  // Cancel pending api requests, see https://axios-http.com/docs/cancellation
  Object.keys(cancelTokenSources).forEach(
    (part) => cancelTokenSources[part]?.cancel?.(`${ part } part: download cancelled.`)
  );
}

const closeExport = () => {
  if (activeTab.value === 'chartAndImages') {
    fetchCancel();
    Object.keys(cancelTokenSources).forEach((key) => {
      delete cancelTokenSources[key];
    });
  }
  resources.value = [];
  showProgressBar.value = false;
  step.value = null;
  exporting.value = false;
  showModal.value = false;
}

const resetErrors = () => {
  errors.value = [];
}

const enableDownload = () => {
  resetErrors();
  showProgressBar.value = true;
}

const disableDownload = () => {
  fetchCancel();
  showProgressBar.value = false;
  toggleStep(null);
}

const delayBeforeClose = async (seconds) => {
  return await new Promise((resolve) => setTimeout(resolve, seconds));
}

const toggleStep = (part, isPreparing = false) => {
  step.value = part ? `${ isPreparing ? 'preparing' : 'download' }.${ part }` : null;
}

defineExpose({
  openExport,
});
</script>

<template>
  <trailhand-modal
    :title="t('epinio.applications.export.label')"
    :open.prop="showModal"
    :dismissible="false"
    @modal-close="closeExport"
  >
    <div id="modal-container-element" class="modal-content">
      <Tabs v-model="activeTab" :tabs="tabs" variant="underline">
        <template #manifest>
          <p>
            {{ t('epinio.applications.export.manifest.description') }}
          </p>
        </template>

        <template #chartAndImages>
          <p>
            {{ t('epinio.applications.export.chartValuesImages.description') }}
          </p>
          <Banner
            color="info"
          >
            {{ t('epinio.applications.export.chartValuesImages.banner') }}
          </Banner>

          <div
            v-if="showProgressBar"
            class="progress-info text info mb-10 mt-20"
          >
            <i class="icon-spinner animate-spin mr-5" />
            <span v-if="step">
              {{ t(`epinio.applications.export.chartValuesImages.steps.${ step }`) }}
            </span>
          </div>
        </template>
      </Tabs>
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>
    <div slot="footer">
      <trailhand-button
        variant="secondary"
        class="mr-10"
        @button-click="closeExport"
      >
        Cancel
      </trailhand-button>
      <trailhand-button
        variant="destructive"
        :disabled="exporting"
        @button-click="exportApplicationManifest"
      >
        {{ exporting ? 'Exporting...' : 'Export' }}
      </trailhand-button>
    </div>
  </trailhand-modal>
</template>
<style lang='scss' scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 750px;
  min-height: 300px;
}

.export-app-dialog {
  &__title {
    margin-bottom: 0;
  }
  &__tab {
    min-height: 110px;
  }
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
