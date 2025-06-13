<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { 
  EPINIO_TYPES, 
  EpinioNamespace, 
  EpinioCatalogService,
} from '../types';
import ServiceInstance from '../models/services';
import { objValuesToString } from '../utils/settings';
import { useEpinioBindAppsMixin } from './bind-apps-mixin';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import ChartValues from '../components/settings/ChartValues.vue';
import EpinioCatalogServiceModel from '../models/catalogservices';

import Banner from '@components/Banner/Banner.vue';
import Loading from '@shell/components/Loading.vue';
import CruResource from '@shell/components/CruResource.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore();
const route = useRoute();
const router = useRouter();
const t = store.getters['i18n/t'];

const props = defineProps<{
  value: ServiceInstance,
  initialValue: ServiceInstance,
  mode: string,
}>();

const { 
  selectedApps, 
  nsAppOptions, 
  noApps, 
  updateServiceInstanceAppBindings,
} = useEpinioBindAppsMixin(props);

const doneRoute = ref<string>('');
const pending = ref<boolean>(true);
const errors = ref<Array<string>>([]);
const doneParams = reactive<object>({});
const validChartValues = ref<object>({});
const failedWaitingForServiceInstance = ref<boolean>(false);
const chartValues = reactive<ChartValues>(objValuesToString(props.value?.settings) || {});

onMounted(async () => {
  await Promise.all([
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE }),
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
  ]);

  pending.value = false;

  //Needed doneParams/doneRoute but the mixin that generates these is a rancher
  //shell mixin, copied parts needed, will move to composable function as needed.
  if (props.value?.doneParams) {
    return props.value.doneParams;
  }

  const out = { ...route.params };

  delete out.namespace;
  delete out.id;

  doneParams.value = out;

  if (props.value?.doneRoute ) {
    doneRoute.value = props.value.doneRoute;
  }else{
    let name = props.route.name;

    if ( name?.endsWith('-id') ) {
      name = name.replace(/(-namespace)?-id$/, '');
    } else if ( name?.endsWith('-create') ) {
      name = name.replace(/-create$/, '');
    }

    doneRoute.value = name;
  }
})

watch(
  () => props.value.meta.namespace,
  () => {
    return selectedApps.value = [];
  }
);

const catalogServices = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE);
});

const selectedCatalogService = computed(() => {
  return catalogServices.value?.find(
    ({id}: EpinioCatalogServiceModel) => id === props.value.catalog_service)
  ;
});

const isEdit = computed(() => {
  return props.mode === 'edit';
});

const validationPassed = computed(() => {
  if (isEdit.value && newBinds.value) {
    return true;
  }
  
  if (!props.value.catalog_service) {
    return false;
  }

  if (!Object.values(validChartValues.value).every((v) => !!v)) {
    return false;
  }

  const nameErrors = validateKubernetesName(
    props.value.name || '', 
    t('epinio.namespace.name'), 
    store.getters, 
    undefined, 
    [],
  );
  const nsErrors = validateKubernetesName(
    props.value.meta.namespace || '', 
    '', 
    store.getters, 
    undefined, 
    [],
  );

  if (nameErrors.length === 0 && nsErrors.length === 0) {
    return !failedWaitingForServiceInstance.value;
  }

  return false;
});

const namespaces = computed(() => {
  return sortBy(store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name');
});

const namespaceNames = computed(() => {
  return namespaces.value.map((n: EpinioNamespace) => n.metadata.name);
});

const catalogServiceOpts = computed(() => {
  return catalogServices.value.map((cs: EpinioCatalogService) => ({
    label: `${cs.name} (${cs.short_description})`,
    value: cs.name,
  }));
});

const noCatalogServices = computed(() => {
  return catalogServices.value.length === 0;
});

const newBinds = computed(() => {
  return !isEqual(sortBy(selectedApps.value), sortBy(props.value.boundapps));
});

const showChartValues = computed(() => {
  return Object.keys(selectedCatalogService.value?.settings || {}).length !== 0;
});

const done = () => {
  if (!doneRoute.value) {
    return;
  }

  router.replace({
    name:   doneRoute.value,
    params: doneParams.value || { resource: props.value.type },
  });
}

const save = async (saveCb: (success: boolean) => void) => {
  errors.value = [];

  const newSettings = !isEqual(
    objValuesToString(chartValues), 
    objValuesToString(props.value.settings),
  );
  
  if (newSettings) {
    props.value.settings = objValuesToString(chartValues.value);
  }else{
    props.value.settings = undefined;
  }

  try {
    if (!isEdit.value) {
      await props.value.create();
      if (selectedApps.value.length) {
        await updateServiceInstanceAppBindings(props.value);
      }
      await store.dispatch(
        'epinio/findAll', 
        { type: props.value.type, opt: { force: true }},
      );

      saveCb(true);
      done();
    }

    if (isEdit.value) {
      if (newSettings) {
        await props.value.update();
      }
      await updateServiceInstanceAppBindings(props.value);
      await props.value.forceFetch();
       
      saveCb(true);
      done();

      //Can't find exactly how this is coming in, seems like a k8s attribute
      //if (!_isBeingDestroyed || !_isDestroyed) {
      //}
    }
  } catch (err: Error | any) {
    if (err.message === 'waitingForServiceInstance') {
      failedWaitingForServiceInstance.value = true;
      errors.value = [t('epinio.serviceInstance.create.catalogService.failedWaitingForServiceInstance')];
    } else {
      errors.value = epinioExceptionToErrorsArray(err);
    }
    saveCb(false);
  }
};

const resetChartValues = () => {
  chartValues.value = {};
  validChartValues.value = {};
};
</script>

<template>
  <Loading v-if="!value || pending" />
  <CruResource
    v-else-if="value"
    :can-yaml="false"
    :done-route="doneRoute"
    :mode="mode"
    :validation-passed="validationPassed"
    :resource="value"
    :errors="errors"
    namespace-key="meta.namespace"
    @finish="save"
    @errors="e=>errors = e"
  >
    <div v-if="errors.length > 0">
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>
    <NameNsDescription
      name-key="name"
      namespace-key="namespace"
      :namespaces-override="namespaceNames"
      :create-namespace-override="true"
      :description-hidden="true"
      :value="value.meta"
      :mode="mode"
    />
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.catalog_service"
          :loading="pending"
          :options="catalogServiceOpts"
          :disabled="pending || isEdit"
          :searchable="true"
          :mode="mode"
          :multiple="false"
          :label-key="'epinio.serviceInstance.create.catalogService.label'"
          :placeholder="pending || noCatalogServices ? t('epinio.serviceInstance.create.catalogService.placeholderNoOptions') : t('epinio.serviceInstance.create.catalogService.placeholderWithOptions')"
          required
          @option:selected="resetChartValues"
        />
      </div>
    </div>
    <div class="spacer" />
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="selectedApps"
          :loading="pending"
          :options="nsAppOptions"
          :disabled="noApps || pending"
          :searchable="true"
          :mode="mode"
          :multiple="true"
          :label-key="'epinio.configurations.bindApps.label'"
          :placeholder="pending || noApps ? t('epinio.configurations.bindApps.placeholderNoOptions') : t('epinio.configurations.bindApps.placeholderWithOptions')"
        />
      </div>
    </div>
    <div
      v-if="showChartValues"
      class="row"
    >
      <div class="col span-6">
        <div class="spacer" />
        <ChartValues
          v-model:value="chartValues"
          :chart="selectedCatalogService.settings"
          :title="t('epinio.services.chartValues.title')"
          :mode="mode"
          @valid="validChartValues = $event"
        />
      </div>
    </div>
  </CruResource>
</template>
