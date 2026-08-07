<script setup lang="ts">

import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import { sortBy } from '@shell/utils/sort';
import { _VIEW, _EDIT } from '@shell/config/query-params';
import { EpinioConfiguration, EpinioService, EPINIO_TYPES, EPINIO_APP_MANIFEST, EpinioAppBindings } from '../../types';
import Application from '../../models/applications';
import ResourceDropdown from './ResourceDropdown.vue';

interface Props {
  initialApplication?: Application;
  application: Application;
  mode: string;
  bindings?: EpinioAppBindings;
  active: boolean;
}

const props = defineProps<Props>();
// 'initial' reports what was bound when the form opened, so the parent can diff
// against it on save instead of re-deriving it from the store.
const emit = defineEmits(['change', 'initial']);

const store = useStore();

const t = store.getters['i18n/t'];

const values = ref({
  configurations: props.initialApplication?.configuration?.configurations || [],
  services: props.initialApplication?.configuration?.services || [],
});

const isLoadingConfigurations = ref(false);
const fetchedConfigurations = ref<any[]>([]);
const cachedConfigurations = ref<any[]>([]);

const isLoadingServices = ref(false);
const fetchedServices = ref<any[]>([]);
const cachedServices = ref<any[]>([]);

const isFetchingConfigsAndServices = ref<boolean>(true);

const hasConfigs = ref<boolean>(props.initialApplication?.configuration?.configurations?.length > 0);
const noConfigs = computed(() => !hasConfigs.value);
const hasServices = ref<boolean>(props.initialApplication?.configuration?.services?.length > 0);
const noServices = computed(() => !hasServices.value);

const fetchConfigurations = async () => {
  if (cachedConfigurations.value.length > 0) {
    fetchedConfigurations.value = cachedConfigurations.value;
    return;
  }
  isLoadingConfigurations.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/namespaces/${props.application.metadata.namespace}/configurations`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.CONFIGURATION, ...item })
    ));
    fetchedConfigurations.value = classifiedData;
    cachedConfigurations.value = classifiedData;
    hasConfigs.value = classifiedData.length > 0;
  } catch (error) {
    console.error('Failed to fetch configurations', error);
  } finally {
    isLoadingConfigurations.value = false;
  }
};

async function searchConfigurations(query: string) {
  isLoadingConfigurations.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/namespaces/${props.application.metadata.namespace}/configurations?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.CONFIGURATION, ...item })
    ));
    fetchedConfigurations.value = classifiedData;
  } catch {
    fetchedConfigurations.value = [];
  } finally {
    isLoadingConfigurations.value = false;
  }
}

const fetchServices = async () => {
  if (cachedServices.value.length > 0) {
    fetchedServices.value = cachedServices.value;
    return;
  }
  isLoadingServices.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/namespaces/${props.application.metadata.namespace}/services`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];

    // classify raw JSON into proper model instances (adds bindServices, etc.)
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.SERVICE_INSTANCE, ...item })
    ));
    fetchedServices.value = classifiedData;
    cachedServices.value = classifiedData;
    hasServices.value = classifiedData.length > 0;
  } catch (error) {
    console.error('Failed to fetch services', error);
  } finally {
    isLoadingServices.value = false;
  }
};

async function searchServices(query: string) {
  isLoadingServices.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/namespaces/${props.application.metadata.namespace}/services?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.SERVICE_INSTANCE, ...item })
    ));
    fetchedServices.value = classifiedData;
  } catch {
    fetchedServices.value = [];
  } finally {
    isLoadingServices.value = false;
  }
}

const fetchData = async () => {
  isFetchingConfigsAndServices.value = true;
  await fetchConfigurations();
  await fetchServices();
  isFetchingConfigsAndServices.value = false;

  // emit initial bindings now that fetched data is available 
  if (props.initialApplication?.configuration?.configurations?.length) {
    const configurationNames = props.initialApplication.configuration.configurations;
    const bound = fetchedConfigurations.value
      .filter((c: any) => configurationNames.includes(c.meta.name));

    values.value.configurations = bound;
    emit('initial', { configurations: bound });
  }

  if (props.initialApplication?.configuration?.services?.length) {
    const serviceNames = props.initialApplication.configuration.services;
    const bound = fetchedServices.value
      .filter((s: any) => serviceNames.includes(s.meta.name));

    values.value.services = bound;
    emit('initial', { services: bound });
  }
};

// fetch data immediately to populate the value with objects instead of strings
onMounted(() => {
  fetchData();
});

const configurations = computed(() => {
  const list = fetchedConfigurations.value
    .filter((s: EpinioConfiguration) => { return s.configuration.type !== 'service'; })
    .map((s: EpinioConfiguration) => ({
      label: s.meta.name,
      value: s.meta.name,
    }));

  return sortBy(list, 'label', false);
});

const services = computed(() => {
  const list = fetchedServices.value.map((s: EpinioService) => ({
    label: `${s.meta.name} (${s.catalog_service})`,
    value: `${props.application.metadata.namespace}/${s.meta.name}`,
  }));

  return sortBy(list, 'label', false);
});

const isView = computed(() => props.mode === _VIEW);
const isFromManifest = computed(
  () => store.$router.currentRoute._value.query.from === EPINIO_APP_MANIFEST
);

// Watchers
watch(values, () => {
  emit('change', {
    configurations: values.value.configurations,
    services: values.value.services,
  })
}, { deep: true });

// if the namespace has no configurations, clear the values.configurations array. If it has configurations and the app is from a manifest, set values.configurations to the bound configurations.
watch(hasConfigs, (neu, old) => {
  if (!neu && values.value.configurations?.length) {
    values.value.configurations = [];
  }
  if (neu && isFromManifest.value) {
    values.value.configurations = fetchedConfigurations.value
      .filter((nc: any) =>
        props.application.configuration.configurations.includes(nc.meta.name)
      );
  }
});

// if the namespace has no services, clear the values.services array. If it has services and the app is from a manifest, set values.services to the bound services.
watch(hasServices, (neu) => {
  if (!neu && values.value.services?.length) {
    values.value.services = [];
  }
  if (neu && isFromManifest.value) {
    const configurations = fetchedConfigurations.value
      .filter((nc: any) =>
        props.application.configuration.configurations.includes(nc.meta.name) &&
        nc.isServiceRelated
      );
    values.value.services = fetchedServices.value
      .filter((s: any) => configurations.some((d: any) => s.meta.name === d.configuration.origin));
  }
});
</script>

<template>
  <div
    v-if="isFetchingConfigsAndServices"
    class="spacer"
  >
    <trailhand-loading-spinner />
  </div>
  <div v-else class="configurations">
    <ResourceDropdown
      :values="values.configurations.filter((c: any) => !c.isServiceRelated).map((c: any) => c.meta.name)"
      :options="configurations"
      :label="t('typeLabel.configurations', { count: 2})"
      :disabled="noConfigs || isView"
      filterable
      multiselect
      :placeholder="noConfigs ? t('epinio.applications.steps.configurations.configurations.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.configurations.select.placeholderWithOptions')"
      :onDropdownChange="(e: CustomEvent) => { 
        const serviceRelatedConfigs = values.configurations.filter((c: any) => c.isServiceRelated);
        const selectedConfigs = e.detail.values.map((c: string) => fetchedConfigurations.find((nc: any) => nc.meta.name === c));
        values.configurations = [...serviceRelatedConfigs, ...selectedConfigs];
      }"
      :fetchAllResources="fetchConfigurations"
      :searchResources="searchConfigurations"
      :isLoading="isLoadingConfigurations"
    />
    <ResourceDropdown
      :values="values.services.map((s: any) => `${props.application.metadata.namespace}/${s.meta.name}`)"
      :options="services"
      :label="t('typeLabel.services', { count: 2})"
      :disabled="noServices || isView"
      filterable
      multiselect
      :placeholder="noServices ? t('epinio.applications.steps.configurations.services.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.services.select.placeholderWithOptions')"
      :onDropdownChange="(e: CustomEvent) => { values.services = e.detail.values.map((s: string) => fetchedServices.find((ns: any) => `${props.application.metadata.namespace}/${ns.meta.name}` === s)); }"
      :fetchAllResources="fetchServices"
      :searchResources="searchServices"
      :isLoading="isLoadingServices"
    />
  </div>
</template>

<style lang='scss' scoped>
.configurations {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
