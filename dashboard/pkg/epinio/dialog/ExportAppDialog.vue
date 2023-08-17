<script>
import GenericPrompt from '@shell/dialog/GenericPrompt';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import JSZip from 'jszip';
import { downloadFile } from '@shell/utils/download';
import PercentageBar from '@shell/components/PercentageBar';
import { APPLICATION_PARTS } from '../types';

const partsWeight = {
  [APPLICATION_PARTS.VALUES]: 0.15,
  [APPLICATION_PARTS.CHART]:  0.15,
  [APPLICATION_PARTS.IMAGE]:  0.7,
};

export default {
  name:       'ExportAppDialog',
  components: {
    GenericPrompt, Banner, PercentageBar, Tabbed, Tab
  },

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
      downloadingPart:    null,
      cancelTokenSources: {},
      progressBar:        0,
      colorStops:         { 0: '--primary', 100: '--primary' },
    };
  },

  mounted() {
    document.addEventListener('keyup', this.escapeHandler);
  },

  beforeDestroy() {
    document.removeEventListener('keyup', this.escapeHandler);
  },

  methods: {
    async exportApplicationManifest() {
      this.showProgressBar = true;
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

        this.progressBar = 100;
        await chartZip(partsData);
      }
    },

    getCancelToken() {
      return this.$store.$axios.CancelToken;
    },

    async fetchPart(resource, part) {
      this.cancelTokenSources[part] = this.getCancelToken().source();
      this.downloadingPart = part;

      return await resource.fetchPart(
        part,
        {
          onDownloadProgress: (progressEvent) => {
            const total = progressEvent.srcElement.getResponseHeader('proxy-content-length') ||
              progressEvent.srcElement.getResponseHeader('content-length');

            if (total) {
              this.progressBar += Math.round((progressEvent.loaded * 100) / total) * partsWeight[part];
            }
          },
          cancelToken: this.cancelTokenSources[part].token
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
    }
  }
};
</script>

<template>
  <GenericPrompt
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
      <Tabbed>
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
            class="zip-parts text info mb-10 mt-20"
          >
            <span
              v-if="progressBar !== 100"
            >
              {{ t('epinio.applications.export.chartValuesImages.stats.downloadFiles') }}: {{ t(`epinio.applications.export.chartValuesImages.stats.parts.${ downloadingPart }`) }}
            </span>
            <PercentageBar
              v-if="progressBar !== 100"
              class="progress-bar"
              :value="progressBar"
              :color-stops="colorStops"
              preferred-direction="MORE"
            />
            <span v-if="progressBar === 100">
              {{ t('epinio.applications.export.chartValuesImages.stats.zipFiles') }}
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

.zip-parts {
  span {
    display: block;
    margin-bottom: 10px;
  }
}
</style>
