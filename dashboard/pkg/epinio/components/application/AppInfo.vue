<script lang="ts" setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import KeyValue from '@shell/components/form/KeyValue.vue';
import ArrayList from '@shell/components/form/ArrayList.vue';
import Loading from '@shell/components/Loading.vue';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';
import { _EDIT } from '@shell/config/query-params';

import { sortBy } from '@shell/utils/sort';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { EPINIO_TYPES, EpinioNamespace, EpinioAppInfo } from '../../types';
import Application from '../../models/applications';
import { objValuesToString } from '../../utils/settings';

interface Data {
  errors: string[],
  values?: EpinioAppInfo
}

const store = useStore();

const t = store.getters['i18n/t'];

// Props
const props = defineProps<{
  application: Application;
  mode: string;
}>();

// Emit function
const emit = defineEmits<{
  (event: 'valid', valid: boolean): void;
  (event: 'change', data: any): void;
}>();

// Reactive state
const errors = ref<string[]>([]);
const values = ref<EpinioAppInfo | undefined>(undefined);
const validSettings = ref<{ [key: string]: boolean }>({});


// Computed properties
const namespaces = computed(() => {
  return sortBy(store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name', false);
});

const namespaceNames = computed(() => namespaces.value.map((n: EpinioNamespace) => n.meta?.name));

const valid = computed(() => {
  if (!values.value) {
    return false;
  }
  const validName = !!values.value.meta?.name;

  const nsErrors = validateKubernetesName(
    values.value.meta?.namespace || '',
    '',
    store.getters,
    undefined,
    [],
  );
  const validNamespace = nsErrors.length === 0;
  const validInstances = typeof Number(values.value.configuration?.instances) !== 'string' && 
    values.value.configuration?.instances >= 0;
  
  return validName && validNamespace && validInstances && 
    Object.values(validSettings.value).every((v) => !!v);
});

const showApplicationVariables = computed(() => {
  return Object.keys(values.value?.configuration?.settings || {}).length !== 0;
});

const isEdit = computed(() => props.mode === _EDIT);

// Mounted lifecycle hook
onMounted(() => {
  const valuesData: EpinioAppInfo = {
    meta: {
      name: props.application.meta?.name,
      namespace: props.application.meta?.namespace || namespaces.value[0]?.meta?.name
    },
    chart: moveBooleansToFront(props.application.chart?.settings) || {},
    configuration: {
      configurations: props.application.configuration?.configurations || [],
      instances: props.application.configuration?.instances || 1,
      environment: props.application.configuration?.environment || {},
      settings: props.application.configuration?.settings || {},
      routes: props.application.configuration?.routes || [],
    },
  };

  values.value = valuesData;
  validSettings.value = {};

  emit('valid', valid.value);

  populateOnEdit();
});

// Methods
const update = () => {
  emit('change', {
    meta: values.value?.meta,
    configuration: {
      ...values.value?.configuration,
      settings: objValuesToString(values.value?.configuration.settings)
    },
  });
};



// Watchers
watch(() => values.value?.configuration.instances, (newVal, oldVal) => {
  values.value.configuration.instances = Number(newVal);
  update()
});
watch(() => values.value?.configuration.environment, update);
watch(() => values.value?.configuration.settings, update, { deep: true });
watch(() => values.value?.configuration.routes, update);
watch(valid, (newValid) => {
  emit('valid', newValid);
});

const populateOnEdit = async () => {
  // We need to fetch the chart settings on edit mode.
  if (isEdit.value || props.mode === 'view') {
    const chartList = await store.dispatch(
      'epinio/findAll', 
      { type: EPINIO_TYPES.APP_CHARTS },
    );

    const filterChart = chartList?.find(
      (chart: any) => chart.id === props.application.configuration.appchart
    );

    if (filterChart?.settings) {
      const customValues = Object.keys(filterChart?.settings).reduce((acc: any, key: any) => {
        acc[key] = props.application.configuration.settings[key] || '';
        return acc;
      }, {});

      values.value.configuration.settings = customValues;
      values.value.chart = moveBooleansToFront(filterChart.settings);
    }
  }
};

// Allows us to move the checkbox at the top of the list so layout-wise looks better
const moveBooleansToFront = (settingsObj: any) => {
  if (!settingsObj) {
    return;
  }
  const entries = Object.entries(settingsObj);

  entries.sort((a: any, b: any) => {
    const aValue = a[1].type === 'bool' ? 0 : 1;
    const bValue = b[1].type === 'bool' ? 0 : 1;

    return aValue - bValue;
  });

  return Object.fromEntries(entries);
};
</script>

<template>
  <Loading v-if="!values" />
  <div v-else>
    <div class="col">
      <NameNsDescription
        data-testid="epinio_app-info_name-ns"
        name-key="name"
        namespace-key="namespace"
        :namespaces-override="namespaceNames"
        :create-namespace-override="true"
        :description-hidden="true"
        :value="values.meta"
        :mode="props.mode"
        @change="update"
        @createNamespace="ns => values.meta.namespace = ns"
      />
    </div>
    <div class="col span-6">
      <LabeledInput
        v-model:value="values.configuration.instances"
        data-testid="epinio_app-info_instances"
        type="number"
        min="0"
        required
        :mode="props.mode"
        :label="t('epinio.applications.create.instances')"
      />
    </div>
    <div class="spacer" />
    <div class="col span-8">
      <ArrayList
        v-model:value="values.configuration.routes"
        data-testid="epinio_app-info_routes"
        :title="t('epinio.applications.create.routes.title')"
        :protip="t('epinio.applications.create.routes.tooltip')"
        :mode="props.mode"
        :value-placeholder="t('epinio.applications.create.routes.placeholder')"
      />
    </div>
    <div class="spacer" />
    <div v-if="isEdit" class="col span-8">
      <Banner color="info">
        {{ t('epinio.applications.create.settingsVars.description') }}
      </Banner>
    </div>
    <div v-if="showApplicationVariables" class="col span-6">
      <ChartValues
        v-model:value="values.configuration.settings"
        :chart="values.chart"
        :title="t('epinio.applications.create.settingsVars.title')"
        :mode="props.mode"
        :disabled="false"
        @valid="validSettings = $event"
      />
      <div class="spacer" />
    </div>
    <div class="col span-8">
      <KeyValue
        v-model:value="values.configuration.environment"
        data-testid="epinio_app-info_envs"
        :mode="props.mode"
        :title="t('epinio.applications.create.envvar.title')"
        :key-label="t('epinio.applications.create.envvar.keyLabel')"
        :value-label="t('epinio.applications.create.envvar.valueLabel')"
        :parse-lines-from-file="true"
      />
      <div class="mb-20" /> <!-- allow a small amount of padding at bottom -->
    </div>
  </div>
</template>
