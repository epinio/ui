<script setup lang="ts">
import { ref, reactive, onBeforeMount, computed, watch } from 'vue';
import { useStore } from 'vuex';
import Loading from '@shell/components/Loading.vue';
import Wizard from '@shell/components/Wizard.vue';

import AppInfo from '../../../../../components/application/AppInfo.vue';
import AppSource from '../../../../../components/application/AppSource.vue';
import AppConfiguration from '../../../../../components/application/AppConfiguration.vue';
import AppProgress from '../../../../../components/application/AppProgress.vue';

import { _CREATE } from '@shell/config/query-params';
import { EpinioAppInfo, EpinioAppBindings, EpinioAppSource, EPINIO_TYPES } from '../../../../../types';
import { createEpinioRoute } from '../../../../../utils/custom-routing';
import { allHash } from '@shell/utils/promise';
import { useUnsavedChangesMixin } from '../../../../../edit/unsaved-changes-mixin';

const store = useStore();

const { setUnsavedChanges } = useUnsavedChangesMixin();

const loading = ref(true);
const value = ref<any>(null);
const mode = ref(_CREATE);
const source = ref<EpinioAppSource>();
const bindings = ref<EpinioAppBindings>();
const appChart = reactive({ chartsList: undefined as any, selectedChart: undefined });
const epinioInfo = ref<any>(null);
const originalModel = ref<any>(null);

// i18n
const t = computed(() => store.getters['i18n/t']);

// Steps
const steps = reactive([
  {
    name: 'source',
    label: t.value('epinio.applications.steps.source.label'),
    subtext: t.value('epinio.applications.steps.source.subtext'),
    ready: false
  },
  {
    name: 'basics',
    label: t.value('epinio.applications.steps.basics.label'),
    subtext: t.value('epinio.applications.steps.basics.subtext'),
    ready: false
  },
  {
    name: 'configurations',
    label: t.value('epinio.applications.steps.configurations.label'),
    subtext: t.value('epinio.applications.steps.configurations.subtext'),
    ready: true,
    nextButton: {
      labelKey: 'epinio.applications.steps.configurations.next',
      style: 'btn role-primary bg-warning'
    }
  },
  {
    name: 'progress',
    label: t.value('epinio.applications.steps.progress.label'),
    subtext: t.value('epinio.applications.steps.progress.subtext'),
    ready: false,
    previousButton: { disable: true }
  }
]);

// Fetch data before mount
onBeforeMount(async () => {
  const hash = await allHash({
    ns: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    info: store.dispatch('epinio/info'),
  });

  epinioInfo.value = hash.info;
  appChart.chartsList = hash.charts;
  originalModel.value = await store.dispatch('epinio/create', { type: EPINIO_TYPES.APP });
  value.value = await store.dispatch('epinio/clone', { resource: originalModel.value });

  loading.value = false;
});

// Track changes to mark as unsaved
watch([source, bindings, value], () => {
  setUnsavedChanges(true);
}, { deep: true });

// Methods
function set(obj: Record<string, any>, changes: Record<string, any>) {
  Object.entries(changes).forEach(([key, val]) => {
    obj[key] = val;
  });
}

function updateInfo(changes: EpinioAppInfo) {
  value.value.meta ||= {};
  value.value.configuration ||= {};
  set(value.value.meta, changes.meta);
  set(value.value.configuration, { settings: appChart.settings });
  set(value.value.configuration, changes.configuration);
}

function updateSource(changes: EpinioAppSource) {
  source.value = {};
  const { appChart: chartId, ...cleanChanges } = changes;

  appChart.selectedChart = chartId;
  value.value.configuration ||= {};
  value.value.configuration.settings = undefined;

  if (chartId) {
    set(value.value.configuration, { appchart: chartId });
    const chart = appChart.chartsList?.find((c: any) => c.id === chartId);

    if (chart?.settings) {
      const customSettings = Object.keys(chart.settings).reduce((acc, key) => {
        acc[key] = '';
        return acc;
      }, {} as Record<string, any>);

      set(value.value.configuration, { settings: customSettings });
      set(value.value, { chart });
    }
  }

  set(source.value, cleanChanges);
}

function updateManifestConfigurations(configs: string[]) {
  set(value.value.configuration, { configurations: configs });
}

function updateConfigurations(changes: EpinioAppBindings) {
  bindings.value = {};
  set(bindings.value, changes);
  set(value.value.configuration, [...changes.configurations]);
}

function cancel() {
  store.$router.replace(value.value.listLocation);
}

function finish() {
  setUnsavedChanges(false); // Clear unsaved changes when app is deployed
  const route = createEpinioRoute('c-cluster-resource-id', {
    cluster: store.getters['clusterId'],
    resource: value.value.type,
    id: `${value.value.meta.namespace}/${value.value.meta.name}`
  });

  store.$router.replace(route);
}
</script>

<template>
  <Loading v-if="loading" />
  <div v-else class="application-wizard">
    <Wizard
      :steps="steps"
      :banner-title="t('epinio.applications.create.title')"
      :banner-title-subtext="t('epinio.applications.create.titleSubText')"
      header-mode="create"
      finish-mode="done"
      :edit-first-step="true"
      class="wizard"
      @cancel="cancel"
      @finish="finish"
    >
      <template #source>
        <AppSource
          :application="value"
          :source="source"
          :mode="mode"
          :info="epinioInfo"
          @change="updateSource"
          @change-app-info="updateInfo"
          @change-app-config="updateManifestConfigurations"
          @valid="(val) => steps[0].ready = val"
        />
      </template>

      <template #basics>
        <AppInfo
          :application="value"
          :source="source"
          :mode="mode"
          @change="updateInfo"
          @valid="(val) => steps[1].ready = val"
        />
      </template>

      <template #configurations>
        <AppConfiguration
          :application="value"
          :mode="mode"
          @change="updateConfigurations"
        />
      </template>

      <template #progress="{ step }">
        <AppProgress
          :application="value"
          :source="source"
          :bindings="bindings"
          :mode="mode"
          :step="step"
        />
      </template>
    </Wizard>
  </div>
</template>

<style lang="scss" scoped>
.application-wizard {
  padding-top: 10px;
  height: 0;
  position: relative;
  overflow: hidden;

  .wizard {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: auto;
  }

  :deep(.step-container__step) {
    padding-bottom: 40px;
  }
}
</style>
