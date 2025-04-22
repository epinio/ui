<script>
import { createApp } from 'vue';
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import JSZip from 'jszip';
import { downloadFile } from '@shell/utils/download';
import PercentageBar from '@shell/components/PercentageBar';
import { APPLICATION_PARTS } from '../types';
const vueApp = createApp({});

const partsWeight = {
  [APPLICATION_PARTS.VALUES]: 0.1,
  [APPLICATION_PARTS.CHART]:  0.1,
  [APPLICATION_PARTS.IMAGE]:  0.7
};

export default {
  name:  'ExportAppDialog',
  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {
      config: {
        title:       this.t('promptRemove.title'),
        applyMode:   'export',
        applyAction: this.exportApplicationManifest,
      },
      zipParts:           this.resources[0].applicationParts.filter((part) => part !== APPLICATION_PARTS.MANIFEST),
      showProgressBar:    false,
      percentages:        {},
      step:               null,
      cancelTokenSources: {},
      colorStops:         { 0: '--primary', 100: '--primary' },
    };
  },

  mounted() {
    document.addEventListener('keyup', this.escapeHandler);
  },

  beforeUnmount() {
    document.removeEventListener('keyup', this.escapeHandler);
  },

  computed: {
    progressBar: {
      get() {
        return Object.keys(this.percentages).reduce((acc, part) => acc + (this.percentages[part] * (partsWeight[part] || 1)), 0);
      },
      set(value) {
        this.percentages = { value };
      }
    }
  },

  methods: {
    async exportApplicationManifest() {
      this.enableDownload();
      const resource = this.resources[0];

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

        const contents = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

        await downloadFile(`${ resource.meta.name }-helm-chart.zip`, contents, 'application/zip');
      };

      if (this.$route.hash === '#manifest') {
        await resource.createManifest();
      } else {
        const partsData = await this.zipParts.reduce(async(acc, part) => ({
          ...await acc,
          [part]: await this.fetchPart(resource, part),
        }), Promise.resolve({}));

        if (Object.values(partsData).some((part) => !part)) {
          return;
        }

        this.toggleStep('zip');

        await chartZip(partsData);

        this.progressBar = 100;
        await this.delayBeforeClose(1500);
      }
    },

    getCancelToken() {
      return this.$store.$axios.CancelToken;
    },

    async fetchPart(resource, part) {
      this.toggleStep(part, true);
      this.cancelTokenSources[part] = this.getCancelToken().source();

      return await resource.fetchPart(
        part,
        {
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.srcElement.getResponseHeader('content-length') ||
              progressEvent.srcElement.getResponseHeader('proxy-content-length');

            if (total) {
              this.percentages.part = Math.round(progressEvent.loaded * 100 / total);
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
    },

    fetchCancel() {
      // Cancel pending api requests, see https://axios-http.com/docs/cancellation
      Object.keys(this.cancelTokenSources).forEach((part) => this.cancelTokenSources[part].cancel(`${ part } part: download cancelled.`));
    },

    close() {
      if (this.$route.hash !== '#manifest') {
        this.fetchCancel();
      }
      this.$emit('close');
    },

    escapeHandler(e) {
      if (e.key === 'Escape') {
        this.close();
      }
    },

    resetErrors() {
      if (this.$refs.genericPrompt) {
        this.$refs.genericPrompt.errors = [];
      }
    },

    enableDownload() {
      this.resetErrors();
      this.showProgressBar = true;
    },

    disableDownload() {
      this.fetchCancel();
      this.showProgressBar = false;
      this.progressBar = 0;
      this.toggleStep(null);
    },

    async delayBeforeClose(seconds) {
      return await new Promise((resolve) => setTimeout(resolve, seconds));
    },

    toggleStep(part, isPreparing = false) {
      this.step = part ? `${ isPreparing ? 'preparing' : 'download' }.${ part }` : null;
    }
  }
};
</script>

<template>
  <GenericPrompt
    ref="genericPrompt"
    v-bind="config"
    @close="close"
  >
    <h4
      slot="title"
      class="text-default-text export-app-dialog__title"
    >
      {{ t('epinio.applications.export.label') }}
    </h4>

    <template slot="body">
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
