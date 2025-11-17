<script setup lang="ts">

import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import { sortBy } from '@shell/utils/sort';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { _VIEW } from '@shell/config/query-params';
import { EpinioConfiguration, EpinioService, EPINIO_TYPES, EPINIO_APP_MANIFEST } from '../../types';
import Application from '../../models/applications';

interface Props {
  initialApplication?: Application;
  application: Application;
  mode: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['change']);

const store = useStore();

const t = store.getters['i18n/t'];

const values = ref({
  configurations: [] as string[],
  services: [] as EpinioService[],
});

const fetchData = async () => {
  await Promise.all([
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CONFIGURATION }),
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE }),
  ]);
};

onMounted(fetchData);

// Computed
const namespacedServices = computed(() =>
  (store.getters['epinio/all'](EPINIO_TYPES.SERVICE_INSTANCE) || [])
    .filter((s: EpinioService) => s.metadata.namespace === props.application.metadata.namespace)
);

const namespacedConfigurations = computed(() =>
  (store.getters['epinio/all'](EPINIO_TYPES.CONFIGURATION) || [])
    .filter((s: EpinioConfiguration) => s.metadata.namespace === props.application.metadata.namespace)
);

const configurations = computed(() => {
  const list = namespacedConfigurations.value
    .filter((s: EpinioConfiguration) => !s.isServiceRelated)
    .map((s: EpinioConfiguration) => ({
      label: s.metadata.name,
      value: s.metadata.name,
    }));

  return sortBy(list, 'label', false);
});

const services = computed(() => {
  const list = namespacedServices.value.map((s: EpinioService) => ({
    label: `${s.metadata.name} (${s.catalog_service})`,
    value: s,
  }));

  return sortBy(list, 'label', false);
});

const noConfigs = computed(() => !configurations.value.length);
const hasConfigs = computed(() => !!configurations.value.length);
const noServices = computed(() => !services.value.length);
const hasServices = computed(() => {
  return services.value.length > 0;
});
const isView = computed(() => props.mode === _VIEW);
const isFromManifest = computed(
  () => store.$router.currentRoute._value.query.from === EPINIO_APP_MANIFEST
);

// Watchers
watch(values, () => emit('change', values.value), { deep: true });

watch(noConfigs, (neu) => {
  if (neu && values.value.configurations?.length) {
    values.value.configurations = [];
  }
});

watch(noServices, (neu) => {
  if (neu && values.value.services?.length) {
    values.value.services = [];
  }
});

watch(hasConfigs, (neu, old) => {
  if (!old && neu) {
    if (props.initialApplication?.configuration?.configurations) {
      values.value.configurations = props.initialApplication.baseConfigurationsNames?.filter(
        (cc: string) => configurations.value.find((c: any) => c.value === cc)
      ) || [];
    }

    if (isFromManifest.value) {
      values.value.configurations = namespacedConfigurations.value
        .filter((nc: any) =>
          props.application.configuration.configurations.includes(nc.metadata.name) &&
          !nc.isServiceRelated
        )
        .map((nc: any) => nc.metadata.name) || [];
    }
  }
}, { immediate: true });

watch(hasServices, (neu, old) => {
    if (!old && neu) {
      if (props.initialApplication?.serviceConfigurationsNames) {
        values.value.services = props.initialApplication.services || [];
      }
    }

    if (isFromManifest.value) {
      const configurations = namespacedConfigurations.value
        .filter((nc: any) =>
          props.application.configuration.configurations.includes(nc.metadata.name) &&
          nc.isServiceRelated
        );

      values.value.services = services.value
        .filter((s: any) => configurations.some((d: any) => s.value.metadata.name === d.configuration.origin))
        .map((elem: any) => elem.value);
    }
}, { immediate: true });
</script>

<template>
  <div>
    <div class="col span-6">
      <LabeledSelect
        v-model:value="values.configurations"
        data-testid="epinio_app-configuration_configurations"
        :disabled="noConfigs || isView"
        :options="configurations"
        :searchable="true"
        :mode="mode"
        :multiple="true"
        :label="t('typeLabel.configurations', { count: 2})"
        :placeholder="noConfigs ? t('epinio.applications.steps.configurations.configurations.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.configurations.select.placeholderWithOptions')"
      />
    </div>
    <div class="spacer" />
    <div class="col span-6">
      <LabeledSelect
        v-model:value="values.services"
        data-testid="epinio_app-configuration_services"
        :disabled="noServices || isView"
        :options="services"
        :searchable="true"
        :mode="mode"
        :multiple="true"
        :label="t('epinio.applications.steps.configurations.services.select.label')"
        :placeholder="noServices ? t('epinio.applications.steps.configurations.services.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.services.select.placeholderWithOptions')"
      />
    </div>
  </div>
</template>

<style lang='scss' scoped>
.labeled-select {
  min-height: 79px;
}
</style>
