<script setup lang="ts">
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ref, reactive, computed, onMounted, watch } from 'vue';

import EpinioConfiguration from '../models/configurations';
import { useEpinioBindAppsMixin } from './bind-apps-mixin';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import { EPINIO_TYPES, EpinioNamespace, EpinioCompRecord } from '../types';

import { sortBy } from '@shell/utils/sort';
import Loading from '@shell/components/Loading.vue';
import Banner from '@components/Banner/Banner.vue';
import KeyValue from '@shell/components/form/KeyValue.vue';
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';

const router = useRouter();
const store = useStore();
const t = store.getters['i18n/t'];

const props = defineProps<{
  value: EpinioConfiguration,
  initialValue: EpinioConfiguration,
  mode: string,
}>();

const { 
  doneParams,
  doneRoute,
  selectedApps, 
  nsAppOptions, 
  noApps, 
  updateConfigurationAppBindings,
} = useEpinioBindAppsMixin(props);

const errors = ref<Array<any>>([]);
const pending = ref<boolean>(true);
const validationPassed = ref<boolean>(false);

onMounted(async () => {
  props.value.meta.namespace = props.initialValue.meta.namespace || 
    namespaces[0]?.metadata.name;
  props.value.data = { ...props.initialValue.configuration?.details };
  selectedApps.value = [...props.initialValue.configuration?.boundapps || []];

  updateValidation();

  pending.value = false;
});

const isEdit = computed(() => {
  return props.mode === 'edit';
});

const namespaces = computed(() => {
  return sortBy(store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name', false);
});

const namespaceNames = computed(() => {
  return namespaces.value.map((n: EpinioNamespace) => n.metadata.name);
});

const done = () => {
  if (!doneRoute) {
    return;
  }

  router.replace({
    name:   doneRoute.value,
    params: doneParams.value || { resource: props.value.type },
  });
}

const save = async (saveCb: (success: boolean) => void) => {
  errors.value = [];

  try {
    if (!isEdit.value) {
      await props.value.create();
      await updateConfigurationAppBindings();
      await store.dispatch(
        'epinio/findAll', 
        { type: props.value.type, opt: { force: true } },
      );
    }

    if (isEdit.value) {
      await props.value.update();
      await updateConfigurationAppBindings();
      await props.value.forceFetch();
    }

    saveCb(true);
    done();
  } catch (err) {
    console.log(err);
    errors.value = epinioExceptionToErrorsArray(err);
    saveCb(false);
  }
};

const updateValidation = () => {
  const nameErrors = validateKubernetesName(
    props.value?.meta.name || '', 
    t('epinio.namespace.name'), 
    store.getters, 
    undefined, 
    [],
  );
  
  const nsErrors = validateKubernetesName(
    props.value?.meta.namespace || '', 
    '', 
    store.getters, 
    undefined, 
    [],
  );

  if (nameErrors.length === 0 && nsErrors.length === 0) {
    const dataValues = Object.entries(props.value?.data || {});
    
    if (!!dataValues.length) {
      validationPassed.value = true;
      return;
    }
  }

  validationPassed.value = false;
};

watch(
  () => props.value.meta.namespace,
  () => {
    selectedApps.value = [];
    updateValidation(); // For when a user is supplying their own ns
  }
);

watch(
  () => props.value.meta.name,
  () => {
    updateValidation();
  }
);

watch(
  () => props.value.data,
  (newValue) => {
    updateValidation();
  },
  { deep: true }
);
</script>

<template>
  <Loading v-if="!value || pending" />
  <CruResource
    v-else-if="value"
    :min-height="'7em'"
    :mode="mode"
    :done-route="doneRoute"
    :resource="value"
    :can-yaml="false"
    :errors="errors"
    :validation-passed="validationPassed"
    namespace-key="meta.namespace"
    @error="(e) => (errors = e)"
    @finish="save"
  >
    <Banner
      v-if="value.isServiceRelated"
      color="info"
    >
      {{ t('epinio.configurations.tableHeaders.service.tooltip') }}
    </Banner>
    <Banner
      v-if="errors.length > 0"
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
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
          v-model:value="selectedApps"
          :loading="pending"
          :disabled="noApps"
          :options="nsAppOptions"
          :searchable="true"
          :mode="mode"
          :multiple="true"
          :label-key="'epinio.configurations.bindApps.label'"
          :placeholder="noApps ? t('epinio.configurations.bindApps.placeholderNoOptions') : t('epinio.configurations.bindApps.placeholderWithOptions')"
        />
      </div>
    </div>
    <div class="spacer" />
    <div class="row">
      <div class="col span-11">
        <KeyValue
          v-model:value="value.data"
          :initial-empty-row="true"
          :mode="mode"
          :title="t('epinio.configurations.pairs.label')"
          :title-protip="t('epinio.configurations.pairs.tooltip')"
          :key-label="t('epinio.applications.create.envvar.keyLabel')"
          :value-label="t('epinio.applications.create.envvar.valueLabel')"
          :valueMarkdownMultiline="true"
          :parse-lines-from-file="true"
          :parse-value-from-file="true"
        />
      </div>
    </div>
  </CruResource>
</template>

<style lang="scss">
.as-text-area {
  width: 100% !important;
}

.value-container .file-selector{
  margin-bottom: 20px;
}
</style>
