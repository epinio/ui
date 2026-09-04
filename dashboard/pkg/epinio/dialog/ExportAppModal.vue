<script setup lang="ts">
import { useStore } from 'vuex'
import { ref } from 'vue';
import Banner from '@components/Banner/Banner.vue';
import Tabs from '../components/application/Tabs.vue';
import { App } from '../models/application/ui-types';
import { createManifest, exportChartAndImages } from '../models/application/actions/export';
import { AppExportCancelMap } from '../models/application/ui-types';

const store = useStore();
const t = store.getters['i18n/t'];

const showModal = ref(false);
const activeTab = ref<string | number>('manifest')
const tabs = ref([
  { id: 'manifest', label: 'Manifest', completed: false, valid: false, disabled: false },
  { id: 'chartAndImages', label: 'Chart and Images', completed: false, valid: false, disabled: false },
]);
const showProgressBar = ref<boolean>(false);
const step = ref<string | null>(null);
const cancelMap = ref<AppExportCancelMap>({});
const appToExport = ref<App | null>(null);
const resources = ref<Array<App>>([]);
const exporting = ref<boolean>(false);
const errors = ref<Array<string>>([]);

function openExport(app: App) {
  appToExport.value = app;
  resources.value = [app];
  showModal.value = true;
}

const exportApplicationManifest = async () => {
  exporting.value = true;
  enableDownload();
  const resource = resources.value[0];
  let exportSucceeded = false;

  try {
    if (activeTab.value === 'manifest') {
      await createManifest(store, resource);
    } else {
      await exportChartAndImages(store, resource, (part, isPreparing = false) => {
        toggleStep(part, isPreparing);
      }, cancelMap.value);
      await delayBeforeClose(1500);
    }

    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.export.success.title'),
      message: t('epinio.growl.application.export.success.message', { name: resource.meta.name }),
    });
    exportSucceeded = true;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      disableDownload();
    } else {
      errors.value.push(e.message ?? 'Error exporting application');
      disableDownload();
      store.dispatch('growl/error', {
        title:   t('epinio.growl.application.export.error.title'),
        message: t('epinio.growl.application.export.error.message'),
      });
    }
  } finally {
    exporting.value = false;
    if (exportSucceeded) closeExport();
  }
};

const fetchCancel = () => {
  Object.entries(cancelMap.value).forEach(([part, controller]) => {
    console.log(part, {
      before: controller.signal.aborted,
    });

    controller.abort();

    console.log(part, {
      after: controller.signal.aborted,
      reason: controller.signal.reason,
    });
  });

  cancelMap.value = {};
};

const closeExport = () => {
  fetchCancel();
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

const delayBeforeClose = async (seconds: number) => {
  return await new Promise((resolve) => setTimeout(resolve, seconds));
}

const toggleStep = (part: string | null, isPreparing = false) => {
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
