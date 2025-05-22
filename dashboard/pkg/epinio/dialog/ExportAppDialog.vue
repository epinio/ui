<script setup lang="ts">
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import {ref, computed, onMounted, onBeforeUnmount } from 'vue';

import JSZip from 'jszip';

import GenericPrompt from '@shell/dialog/GenericPrompt';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import { downloadFile } from '@shell/utils/download';
import PercentageBar from '@shell/components/PercentageBar';
import { APPLICATION_PARTS } from '../types';

const store = useStore();
const route = useRoute();
const t = store.getters['i18n/t'];

const partsWeight = {
  [APPLICATION_PARTS.VALUES]: 0.1,
  [APPLICATION_PARTS.CHART]:  0.1,
  [APPLICATION_PARTS.IMAGE]:  0.7
};

const props = defineProps<{
  resources: Array,
}>();

const zipParts = resources[0].applicationParts.filter(
  (part) => part !== APPLICATION_PARTS.MANIFEST
);
const showProgressBar = ref<boolean>(false);
const percentages = ref<object>({});
const step = ref<any>(null);
const cancelTokenSources:object = {};
const colorStops:object = { 0: '--primary', 100: '--primary' };

onMounted(() => {
  document.addEventListener('keyup', escapeHandler);
});

onBeforeUnmount(() => {
  document.removeEventListener('keyup', escapeHandler);
});

const progressBar = computed({
  get() {
    return Object.keys(percentages).reduce(
      (acc, part) => acc + (percentages[part] * (partsWeight[part] || 1)), 0);
  },
  set(value) {
    percentages = { value };
  }
});

const exportApplicationManifest = async () => {
  enableDownload();
  const resource = resources[0];

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
    part,
    {
      onDownloadProgress: (progressEvent) => {
        const total = progressEvent.srcElement.getResponseHeader('content-length') ||
          progressEvent.srcElement.getResponseHeader('proxy-content-length');

        if (total) {
          Vue.set(this.percentages, part, Math.round(progressEvent.loaded * 100 / total));
        }

        if (progressEvent.loaded > 0) {
          this.toggleStep(part);
        }
      },
      cancelToken: this.cancelTokenSources[part].token
    }).catch((thrown) => {
    if (!this.$store.$axios.isCancel(thrown)) {
      this.disableDownload();

      // Override only messages of server errors
      const message = thrown.message ?? this.t('epinio.applications.export.chartValuesImages.error', { part });

      throw new Error(message);
    }
  });
}

const fetchCancel = () => {
  // Cancel pending api requests, see https://axios-http.com/docs/cancellation
  Object.keys(this.cancelTokenSources).forEach((part) => this.cancelTokenSources[part].cancel(`${ part } part: download cancelled.`));
}

const close = () => {
  if (this.$route.hash !== '#manifest') {
    this.fetchCancel();
  }
  this.$emit('close');
}

const escapeHandler = (e) => {
  if (e.key === 'Escape') {
    this.close();
  }
}

const resetErrors = () => {
  if (this.$refs.genericPrompt) {
    this.$refs.genericPrompt.errors = [];
  }
}

const enableDownload = () => {
  this.resetErrors();
  this.showProgressBar = true;
}

const disableDownload = () => {
  this.fetchCancel();
  this.showProgressBar = false;
  this.progressBar = 0;
  this.toggleStep(null);
}

const delayBeforeClose = async (seconds) => {
  return await new Promise((resolve) => setTimeout(resolve, seconds));
}

const toggleStep = (part, isPreparing = false) => {
  this.step = part ? `${ isPreparing ? 'preparing' : 'download' }.${ part }` : null;
}
</script>

<template>

    <h4
      class="text-default-text export-app-dialog__title"
    >
      {{ t('epinio.applications.export.label') }}
    </h4>
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
            :value="progressBar"
            :color-stops="colorStops"
            preferred-direction="MORE"
          />
        </div>
      </Tab>
    </Tabbed>
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
