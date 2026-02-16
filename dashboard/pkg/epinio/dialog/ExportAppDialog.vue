<script setup lang="ts">
import { useStore } from 'vuex'
import { ref, onMounted, onBeforeUnmount } from 'vue';

import JSZip from 'jszip';

import { APPLICATION_PARTS } from '../types';
import Banner from '@components/Banner/Banner.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import { downloadFile } from '@shell/utils/download';
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Tabbed from '@shell/components/Tabbed/index.vue';

const store = useStore();
const t = store.getters['i18n/t'];
const emit = defineEmits<{
  (e: 'close'): void
}>();

const props = defineProps<{
  resources: Array,
}>();

const showProgressBar = ref<boolean>(false);
const step = ref<any>(null);
const cancelTokenSources:object = {};
const genericPrompt = ref<HTMLElement>(null);

const zipParts = props.resources[0]?.applicationParts.filter(
  (part) => part !== APPLICATION_PARTS.MANIFEST
);

onMounted(() => {
  document.addEventListener('keyup', escapeHandler);
});

onBeforeUnmount(() => {
  //Need to wait to remove this so the event listener isn't removed before a 
  //download is cancelled.
  setTimeout(() => {
    document.removeEventListener('keyup', escapeHandler);
  }, 2000);
});

const exportApplicationManifest = async () => {
  enableDownload();
  const resource = props.resources[0];

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

  if (store.$router.currentRoute._value.hash === '#manifest') {
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
      return;
    }

    // Fallback: fetch three parts and zip in browser (slower, especially in Rancher extension)
    const partsData = await zipParts.reduce(async(acc, part) => ({
      ...await acc,
      [part]: await fetchPart(resource, part),
    }), Promise.resolve({}));

    if (Object.values(partsData).some((part) => !part)) {
      return;
    }

    toggleStep('zip');

    await chartZip(partsData);

    await delayBeforeClose(1500);
  }
}

const config = {
  title:       t('promptRemove.title'),
  applyMode:   'export',
  applyAction: exportApplicationManifest,
};

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

const close = () => {
  if (store.$router.currentRoute._value.hash !== '#manifest') {
    fetchCancel();
  }

  emit('close');
}

const escapeHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    close();
  }
}

const resetErrors = () => {
  if (genericPrompt.value) {
    genericPrompt.value.errors = [];
  }
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
</script>

<template>
  <GenericPrompt
    ref="genericPrompt"
    v-bind="config"
    @close="close"
  >
    <template #title>
      <h4
        class="text-default-text export-app-dialog__title"
      >
        {{ t('epinio.applications.export.label') }}
      </h4>
    </template>

    <template #body>
      <Tabbed @changed="resetErrors">
        <Tab
          label-key="epinio.applications.export.manifest.title"
          name="manifest"
          :weight="3"
          class="export-app-dialog__tab"
        >
          <p>
            {{ t('epinio.applications.export.manifest.description') }}
          </p>
        </Tab>

        <Tab
          label-key="epinio.applications.export.chartValuesImages.title"
          name="chart"
          :weight="2"
          class="export-app-dialog__tab"
        >
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
        </Tab>
      </Tabbed>
    </template>
  </GenericPrompt>
</template>
<style lang='scss' scoped>
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
