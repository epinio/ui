<script setup lang="ts">
import { useStore } from 'vuex'
import {ref, computed, onMounted, onBeforeUnmount } from 'vue';

import JSZip from 'jszip';

import { APPLICATION_PARTS } from '../types';
import Banner from '@components/Banner/Banner.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import { downloadFile } from '@shell/utils/download';
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Tabbed from '@shell/components/Tabbed/index.vue';
import PercentageBar from '@shell/components/PercentageBar';

const store = useStore();
const t = store.getters['i18n/t'];
const emit = defineEmits<{
  (e: 'close'): void
}>();

const props = defineProps<{
  resources: Array,
}>();

const showProgressBar = ref<boolean>(false);
const percentages = ref<object>({});
const step = ref<any>(null);
const cancelTokenSources:object = {};
const colorStops:object = { 0: '--primary', 100: '--primary' };
const genericPrompt = ref<HTMLElement>(null);

const partsWeight = {
  [APPLICATION_PARTS.VALUES]: 0.1,
  [APPLICATION_PARTS.CHART]:  0.1,
  [APPLICATION_PARTS.IMAGE]:  0.7
};

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

const progressBar = computed({
  get() {
    return Object.keys(percentages.value).reduce(
      (acc, part) => acc + (percentages.value[part] * (partsWeight[part] || 1)), 0);
  },
  set(value) {
    percentages.value = { value };
  }
}, { immediate: true });

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

  if (route.hash === '#manifest') {
    await resource.createManifest();
  } else {
    const partsData = await zipParts.reduce(async(acc, part) => ({
      ...await acc,
      [part]: await fetchPart(resource, part),
    }), Promise.resolve({}));

    if (Object.values(partsData).some((part) => !part)) {
      return;
    }

    toggleStep('zip');

    await chartZip(partsData);

    progressBar.value = 100;
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

const fetchPart = async (resource, part) => {
  toggleStep(part, true);
  cancelTokenSources[part] = getCancelToken().source();

  return await resource.fetchPart(
    part, {
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.event.srcElement.getResponseHeader('content-length') ||
          progressEvent.event.srcElement.getResponseHeader('proxy-content-length');

        if (total) {
          percentages.value[part] = Math.round(progressEvent.loaded * 100 / total);
        }

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
    (part) => cancelTokenSources[part].
      cancel(`${ part } part: download cancelled.`)
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
  progressBar.value = 0;
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
            <span v-if="step">
              {{ t(`epinio.applications.export.chartValuesImages.steps.${ step }`) }}
            </span>
            <PercentageBar
              class="progress-bar"
              :modelValue="progressBar"
              :color-stops="colorStops"
              preferred-direction="MORE"
            />
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
  span {
    display: block;
    margin-bottom: 10px;
  }
}
</style>
