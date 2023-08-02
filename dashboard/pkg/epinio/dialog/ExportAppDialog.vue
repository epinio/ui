<script>
import Vue from 'vue';

import GenericPrompt from '@shell/dialog/GenericPrompt';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import JSZip from 'jszip';
import { downloadFile } from '@shell/utils/download';
import PercentageBar from '@shell/components/PercentageBar';
import { APPLICATION_PARTS } from '../types';

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
      zipParts:         this.resources[0].applicationParts.filter((part) => part !== APPLICATION_PARTS.MANIFEST),
      showProgressBars: false,
      progressBars:     {},
      colorStops:       { 0: '--success', 100: '--success' },
    };
  },

  methods: {
    async exportApplicationManifest() {
      this.showProgressBars = true;
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

        await chartZip(partsData);
      }
    },

    async fetchPart(resource, part) {
      return await resource.fetchPart(
        part,
        {
          onDownloadProgress: (progressEvent) => {
            /**
             * X-Content-Length is a custom header from ui-backend service
             */
            const total = progressEvent.srcElement.getResponseHeader('X-Content-Length') ||
              progressEvent.srcElement.getResponseHeader('content-length');

            if (total) {
              const percentage = Math.round((progressEvent.loaded * 100) / total);

              Vue.set(this.progressBars, part, percentage);
            }
          }
        });
    },
  }
};
</script>

<template>
  <GenericPrompt
    v-bind="config"
    @close="$emit('close')"
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
            v-if="showProgressBars"
            class="zip-parts text info mb-10 mt-20"
          >
            <span class="title">
              {{ t('epinio.applications.export.chartValuesImages.stats.title') }}
            </span>
            <div
              v-for="part in zipParts"
              :key="part"
              class="parts"
            >
              <span class="label">
                {{ t(`epinio.applications.export.chartValuesImages.stats.parts.${ part }`) }}
              </span>
              <PercentageBar
                v-if="progressBars[part] !== 100"
                class="progress-bar"
                :value="progressBars[part] || 0"
                :color-stops="colorStops"
                preferred-direction="MORE"
              />
              <i
                v-if="progressBars[part] === 100"
                class="icon icon-checkmark"
              />
            </div>
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
  .title {
    display: block;
    margin-bottom: 10px;
  }
  .parts {
    display: flex;
    align-items: center;
    width: 100%;
    .label {
      width: 60px;
    }
    .progress-bar {
      width: 150px;
    }
  }
}
</style>
