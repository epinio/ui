<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';

import Application from '../models/applications';
import CruResource from '@shell/components/CruResource.vue';
import ResourceTabs from '@shell/components/form/ResourceTabs/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import Loading from '@shell/components/Loading.vue';
import AppInfo, { EpinioAppInfo } from '../components/application/AppInfo.vue';
import AppConfiguration, { EpinioAppBindings } from '../components/application/AppConfiguration.vue';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import Wizard from '@shell/components/Wizard.vue';
import { createEpinioRoute } from '../utils/custom-routing';
import AppSource from '../components/application/AppSource.vue';
import AppProgress from '../components/application/AppProgress.vue';
import { EpinioAppSource, EPINIO_TYPES } from '../types';
import { allHash } from '@shell/utils/promise';

import { _EDIT } from '@shell/config/query-params';

const props = defineProps<{
  value: Application,
  initialValue: Application,
  mode: string
}>();

const emit = defineEmits(['error', 'finish']);

const route = useRoute();
const router = useRouter();
const store = useStore();

const errors = ref<string[]>([]);
const source = ref<EpinioAppSource | undefined>(structuredClone(props.value.appSource));
const bindings = ref<EpinioAppBindings>({
  configurations: [],
  services: []
});

if (source.value?.git && route.query?.commit) {
  source.value.git.commit = route.query.commit as string;
}

const steps = ref([
  {
    name:       'source',
    label:      `epinio.applications.steps.source.label`,
    subtext:    `epinio.applications.steps.source.subtext`,
    ready:      false,
    nextButton: {
      labelKey: 'epinio.applications.steps.configurations.update',
      style:    'btn role-primary bg-warning'
    }
  },
  {
    name:           'progress',
    label:          'epinio.applications.steps.progress.label',
    subtext:        'epinio.applications.steps.progress.subtext',
    ready:          false,
    previousButton: { disable: true }
  }
]);

const epinioInfo = ref();
const tabErrors = ref<Record<string, boolean>>({ appInfo: false });

const shouldShowButtons = computed(() => {
  return route.hash === '#source' ? 'hide-buttons-deploy' : '';
});

const showSourceTab = computed(() => props.mode === _EDIT);

const validationPassed = computed(() => {
  return !Object.values(tabErrors.value).includes(true);
});

async function fetchData() {
  const hash = await allHash({
    ns:     store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    info:   store.dispatch('epinio/info'),
  });

  epinioInfo.value = hash.info;
}

onMounted(() => {
  fetchData();
});

function set(obj: any, changes: Record<string, any>) {
  Object.entries(changes).forEach(([key, value]) => {
    obj[key] = value;
  });
}

async function save(saveCb: (success: boolean) => void) {
  errors.value = [];

  try {
    await props.value.update();

    await props.value.updateConfigurations(
      props.initialValue.baseConfigurationsNames || [],
      bindings.value?.configurations || []
    );

    await props.value.updateServices(
      props.initialValue.services || [],
      bindings.value?.services || []
    );

    await props.value.forceFetch();
    saveCb(true);
    done();
  } catch (err) {
    errors.value = epinioExceptionToErrorsArray(err);
    saveCb(false);
  }
}

function updateInfo(changes: EpinioAppInfo) {
  props.value.meta = props.value.meta || {};
  props.value.configuration = props.value.configuration || {};
  set(props.value.meta, changes.meta);
  set(props.value.configuration, changes.configuration);
}

function updateConfigurations(changes: EpinioAppBindings) {
  bindings.value = changes;
  set(props.value.configuration, [...changes.configurations]);
}

function cancel() {
  router.replace(props.value.listLocation);
}

function done() {
  emit('finish');
}

function finish() {
  router.replace(createEpinioRoute('c-cluster-resource-id', {
    cluster:  store.getters['clusterId'],
    resource: props.value.type,
    id:       `${ props.value.meta.namespace }/${ props.value.meta.name }`
  }));
}

function updateSourceData(changes: EpinioAppSource) {
  source.value = {} as EpinioAppSource;
  const { appChart, ...cleanChanges } = changes;

  props.value.configuration = props.value.configuration || {};

  if (appChart) {
    set(props.value.configuration, { appchart: appChart });
  }

  set(source.value, cleanChanges);
}

function updateManifestConfigurations(changes: string[]) {
  set(props.value.configuration, { configurations: changes });
}

function validateTab(value: boolean, tab: string) {
  if (tab) {
    tabErrors.value[tab] = !value;
  }

  steps.value[0].ready = value;
}
</script>

<template>
  <Loading v-if="!props.value || false" /> <!-- Replace with loading state as needed -->
  <CruResource
    v-else
    :class="shouldShowButtons"
    :can-yaml="false"
    :mode="props.mode"
    :resource="props.value"
    :errors="errors"
    :validation-passed="validationPassed"
    @error="e => errors = e"
    @finish="save"
  >
    <ResourceTabs v-model:value="props.value" :mode="props.mode">
      <Tab
        v-if="showSourceTab"
        label-key="epinio.applications.steps.source.label"
        name="source"
        :weight="30"
      >
        <div class="wizard-container">
          <Wizard
            class="wizard"
            :steps="steps"
            :banner-title="$t('epinio.applications.steps.source.label')"
            :banner-title-subtext="$t('epinio.applications.steps.source.subtext')"
            header-mode="edit"
            finish-mode="done"
            :edit-first-step="true"
            @cancel="cancel"
            @finish="finish"
          >
            <template #source>
              <AppSource
                v-if="source"
                :application="props.value"
                :source="source"
                :mode="props.mode"
                :info="epinioInfo"
                @change="updateSourceData"
                @changeAppInfo="updateInfo"
                @changeAppConfig="updateManifestConfigurations"
                @valid="val => steps[0].ready = val"
              />
            </template>
            <template #progress="{step}">
              <AppProgress
                :application="props.value"
                :source="source"
                :bindings="bindings"
                :mode="props.mode"
                :step="step"
              />
            </template>
          </Wizard>
        </div>
      </Tab>

      <Tab
        label-key="epinio.applications.steps.basics.label"
        name="info"
        :weight="20"
        :error="tabErrors.appInfo"
      >
        <AppInfo
          :application="props.value"
          :mode="props.mode"
          @change="updateInfo"
          @valid="(val) => validateTab(val, 'appInfo')"
        />
      </Tab>

      <Tab
        label-key="epinio.applications.steps.configurations.label"
        name="configurations"
        :weight="10"
      >
        <AppConfiguration
          :application="props.value"
          :initial-application="props.initialValue"
          :mode="props.mode"
          @change="updateConfigurations"
        />
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style scoped lang="scss">
.wizard-container {
  position: relative;
  margin-bottom: -20px;
  margin-right: -20px;

  .wizard {
    position: relative;
    overflow: auto;

    .appSource, .progress-container {
      padding-bottom: 75px;
    }
  }
}
</style>

<style lang="scss">
.hide-buttons-deploy {
  .cru__footer {
    display: none !important;
  }
}
</style>
