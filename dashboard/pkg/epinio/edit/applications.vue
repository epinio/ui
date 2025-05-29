<script lang="ts" setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import Application from '../models/applications';
import CruResource from '@shell/components/CruResource.vue';
import ResourceTabs from '@shell/components/form/ResourceTabs/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import Loading from '@shell/components/Loading.vue';
import AppInfo from '../components/application/AppInfo.vue';
import AppConfiguration from '../components/application/AppConfiguration.vue';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import { useEpinioBindAppsMixin } from './bind-apps-mixin';

import Wizard from '@shell/components/Wizard.vue';
import { createEpinioRoute } from '../utils/custom-routing';
import AppSource from '../components/application/AppSource.vue';
import AppProgress from '../components/application/AppProgress.vue';
import { EpinioAppSource, EPINIO_TYPES, EpinioAppInfo, EpinioAppBindings } from '../types';
import { allHash } from '@shell/utils/promise';
import { _EDIT } from '@shell/config/query-params';

const props = defineProps<{ 
  value: Application;
  initialValue: Application;
  mode: string;
}>();

const { 
  doneParams,
  doneRoute,
} = useEpinioBindAppsMixin(props);

const store = useStore();
const route = useRoute();
const router = useRouter();

const t = store.getters['i18n/t'];

const bindings = reactive<EpinioAppBindings>({ configurations: [], services: [] });
const source = ref<EpinioAppSource>(props.value.appSource);
const errors = ref<string[]>([]);
const epinioInfo = ref();
const tabErrors = reactive<{ appInfo: boolean }>({ appInfo: false });

const steps = reactive([
  {
    name: 'source',
    label: t('epinio.applications.steps.source.label'),
    subtext: t('epinio.applications.steps.source.subtext'),
    ready: false,
    nextButton: {
      labelKey: 'epinio.applications.steps.configurations.update',
      style: 'btn role-primary bg-warning'
    }
  },
  {
    name: 'progress',
    label: t('epinio.applications.steps.progress.label'),
    subtext: t('epinio.applications.steps.progress.subtext'),
    ready: false,
    previousButton: { disable: true }
  },
]);

if (source.value.git && route.query?.commit) {
  source.value.git.commit = route.query.commit as string;
}

onMounted(async () => {
  const hash = await allHash({
    ns: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.NAMESPACE }),
    charts: store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS }),
    info: store.dispatch('epinio/info'),
  });

  epinioInfo.value = (hash as { info: any }).info;
});

const shouldShowButtons = computed(() => (route.hash === '#source' ? 'hide-buttons-deploy' : ''));
const showSourceTab = computed(() => {
  return props.mode === _EDIT
});
const validationPassed = computed(() => !Object.values(tabErrors).find((error) => error));

const done = () => {
  if (!doneRoute) {
    return;
  }

  router.replace({
    name:   doneRoute.value,
    params: doneParams.value || { resource: props.value.type },
  });
}


async function save(saveCb: (success: boolean) => void) {
  errors.value = [];
  try {
    await props.value.update();

    await props.value.updateConfigurations(
      props.initialValue.baseConfigurationsNames || [],
      bindings.configurations || [],
    );

    await props.value.updateServices(
      props.initialValue.services || [],
      bindings.services || [],
    );

    await props.value.forceFetch();
    saveCb(true);
    done();
  } catch (err) {
    errors.value = epinioExceptionToErrorsArray(err);
    saveCb(false);
  }
}

function set(obj: Record<string, any>, changes: Record<string, any>) {
  Object.entries(changes).forEach(([key, value]) => {
    obj[key] = value;
  });
}

function updateInfo(changes: EpinioAppInfo) {
  props.value.meta = props.value.meta || {};
  props.value.configuration = props.value.configuration || {};
  set(props.value.meta, changes.meta);
  set(props.value.configuration, changes.configuration);
}

function updateConfigurations(changes: EpinioAppBindings) {
  Object.assign(bindings, changes);
}

function cancel() {
  router.replace(props.value.listLocation);
}

function finish() {
  router.replace(createEpinioRoute(`c-cluster-resource-id`, {
    cluster: store.getters['clusterId'],
    resource: props.value.type,
    id: `${props.value.meta.namespace}/${props.value.meta.name}`,
  }));
}

function updateSource(changes: EpinioAppSource) {
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

function validate(value: boolean, tab: string) {
  if (tab) {
    tabErrors[tab] = !value;
  }

  steps[0].ready = value;
}
</script>


<template>
  <Loading v-if="!value" />
  <CruResource
    v-else
    :class="shouldShowButtons"
    :can-yaml="false"
    :mode="mode"
    :resource="value"
    :errors="errors"
    :validation-passed="validationPassed"
    @error="(e : Error) => errors = epinioExceptionToErrorsArray(e)"
    @finish="save"
  >
    <ResourceTabs
      mode="mode"
    >
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
            :banner-title="t('epinio.applications.steps.source.label')"
            :banner-title-subtext="t('epinio.applications.steps.source.subtext')"
            header-mode="edit"
            finish-mode="done"
            :edit-first-step="true"
            @cancel="cancel"
            @finish="finish"
          >
            <template #source>
              <AppSource
                v-if="source"
                :application="value"
                :source="source"
                :mode="mode"
                :info="epinioInfo"
                @change="updateSource"
                @changeAppInfo="updateInfo"
                @changeAppConfig="updateManifestConfigurations"
                @valid="steps[0].ready = $event"
              />
            </template>
            <template #progress="{step}">
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
      </Tab>
      
      <Tab
        label-key="epinio.applications.steps.basics.label"
        name="info"
        :weight="20"
        :error="tabErrors.appInfo"
      >
        <AppInfo
          :application="value"
          :mode="mode"
          @change="updateInfo"
          @valid="validate($event, 'appInfo')"
        />
      </Tab>
      <Tab
        label-key="epinio.applications.steps.configurations.label"
        name="configurations"
        :weight="10"
      >
        <AppConfiguration
          :application="value"
          :initial-application="initialValue"
          :mode="mode"
          @change="updateConfigurations"
        />
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang='scss' scoped>

.wizard-container {
  position: relative;

  margin-bottom: -20px;
  margin-right: -20px;

  .wizard {
    position: relative;
    overflow: auto;

    // This is a hack and is needed as the wizard's buttons are now `position: absolute; bottom: 0;` so appears over wizard content
    // In the dashabord app chart install wizard this is applied to specific content winthin the wizard (scroll__content)
    // We applied the same thing here
    // Both places need to be removed and the padding added within the wizard component
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
