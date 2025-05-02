<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, computed, reactive, defineOptions, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import ServiceInstance from '../models/services';
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource.vue';
import Loading from '@shell/components/Loading.vue';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { EPINIO_TYPES, EpinioNamespace, EpinioCompRecord, EpinioCatalogService } from '../types';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import ChartValues from '../components/settings/ChartValues.vue';
import EpinioBindAppsMixin from './bind-apps-mixin.js';
import { mapGetters } from 'vuex';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { objValuesToString } from '../utils/settings';

const EPINIO_SERVICE_PARAM = 'service';

interface Data {}

defineOptions({
  mixins: [CreateEditView, EpinioBindAppsMixin],
});

const noApps = computed(() => {
  return !EpinioBindAppsMixin.computed.noApps()
});

const props = defineProps<{
  value: object,
  initialValue: object,
  mode: string,
}>();

const route = useRoute();
const store = useStore();
const t = store.getters['i18n/t'];

const catalogServices = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE);
});

const selectedCatalogService = computed(() => {
  return catalogServices.value?.find(
    ({ name }: EpinioCatalogServiceModel) => name === props.value.catalog_service)
  ;
});

const pending = ref<boolean>(true);
const errors = ref<Array<string>>([]);
const failedWaitingForServiceInstance = ref<Array<string>>([]);
const selectedApps = ref<Array<string>>(props.value?.boundapps || []);
const chartValues = ref<Array<string>>(objValuesToString(props.value?.settings) || {});
const validChartValues = ref<object>({});

onMounted(async () => {
  await Promise.all([
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE }),
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP }),
  ]);
  pending.value = false;
})

watch(
  () => props.value.meta.namespace,
  () => {
    return selectedApps.value = [];
  }
);

const isEdit = computed(() => {
  return !props.mode === 'edit';
});

const validationPassed = computed(() => {
  if (isEdit.value && newBinds.value) {
    return true;
  }

  if (!props.value.catalog_service) {
    return false;
  }

  if (!Object.values(validChartValues).every((v) => !!v)) {
    return false;
  }

  const nameErrors = validateKubernetesName(
    props.value.name || '', 
    t.value('epinio.namespace.name'), 
    store.getters, 
    undefined, 
    [],
  );
  const nsErrors = validateKubernetesName(props.value.meta.namespace || '', '', store.getters, undefined, []);

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
  return !isEqual(sortBy(selectedApps), sortBy(props.value.boundapps));
});

const showChartValues = computed(() => {
  return Object.keys(selectedCatalogService.value?.settings || {}).length !== 0;
});


async function save(saveCb: (success: boolean) => void) {
  errors = [];

  const newSettings = !isEqual(
    objValuesToString(chartValues), 
    objValuesToString(value.settings),
  );

  if (newSettings) {
    value.settings = objValuesToString(chartValues);
  }

  try {
    if (isCreate) {
      await props.value.create();
      if (selectedApps.length) {
        await updateServiceInstanceAppBindings(value);
      }
      await store.dispatch(
        'epinio/findAll', 
        { type: props.value.type, opt: { force: true }},
      );
    }

    if (isEdit) {
      if (newSettings) {
        await value.update();
      }
      await updateServiceInstanceAppBindings(value);
      await value.forceFetch();
    }

    if (!_isBeingDestroyed || !_isDestroyed) {
      saveCb(true);
      done();
    }
  } catch (err: Error | any) {
    if (err.message === 'waitingForServiceInstance') {
      Vue.set( 'failedWaitingForServiceInstance', true);
      errors = [t('epinio.serviceInstance.create.catalogService.failedWaitingForServiceInstance')];
    } else {
      errors = epinioExceptionToErrorsArray(err);
    }
    saveCb(false);
  }
};

async function resetChartValues() {
  chartValues = {};
  validChartValues = {};
};
</script>

<template>
  <Loading v-if="!value || $fetchState.pending" />
  <CruResource
    v-else-if="value"
    :can-yaml="false"
    :done-route="doneRoute"
    :mode="mode"
    :validation-passed="validationPassed"
    :resource="value"
    :errors="errors"
    namespace-key="meta.namespace"
    @error="e=>errors = e"
    @finish="save"
  >
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
          :placeholder="$fetchState.pending || noCatalogServices ? t('epinio.serviceInstance.create.catalogService.placeholderNoOptions') : t('epinio.serviceInstance.create.catalogService.placeholderWithOptions')"
          required
          @option:selected="resetChartValues"
        />
      </div>
    </div>
    <div class="spacer" />
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model="selectedApps"
          :loading="pending"
          :options="nsAppOptions"
          :disabled="noApps || pending"
          :searchable="true"
          :mode="mode"
          :multiple="true"
          :label-key="'epinio.configurations.bindApps.label'"
          :placeholder="$fetchState.pending || noApps ? t('epinio.configurations.bindApps.placeholderNoOptions') : t('epinio.configurations.bindApps.placeholderWithOptions')"
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
          v-model="chartValues"
          :chart="selectedCatalogService.settings"
          :title="t('epinio.services.chartValues.title')"
          :mode="mode"
          @valid="validChartValues = $event"
        />
      </div>
    </div>
  </CruResource>
</template>

