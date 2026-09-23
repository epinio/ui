<script setup lang="ts">

import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import { _VIEW } from '@shell/config/query-params';
import { EpinioConfiguration, EpinioService, EPINIO_TYPES, EPINIO_APP_MANIFEST, EpinioAppBindings } from '../../types';
import Application from '../../models/applications';
import ResourceDropdown from './ResourceDropdown.vue';
import { ListResourceRequestParams, ResourceQueryOptions } from '../../models/resource/ui-types';
import { useServices } from '../../queries/useServiceQueries';
import { useConfigurations } from '../../queries/useConfigurationQueries';
import { debounce } from 'lodash';

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

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
  namespaces: props.application.metadata.namespace ? [props.application.metadata.namespace] : [],
});
const requestOptions = ref<ResourceQueryOptions>({
  enabled: !!props.application.metadata.namespace,
  polling: false,
});
const {data: fetchedServices, isLoading: isLoadingServices, isError: isErrorServices, error: servicesError} = useServices(store, requestParams, requestOptions);
const {data: fetchedConfigurations, isLoading: isLoadingConfigurations, isError: isErrorConfigurations, error: configurationsError} = useConfigurations(store, requestParams, requestOptions);

const onServicesFilter = debounce((query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const onConfigurationsFilter = debounce((query: string) => {
  requestParams.value.page = 1;
  requestParams.value.search = query;
}, 500);

const hasConfigs = ref<boolean>(fetchedConfigurations.value?.items ? fetchedConfigurations.value?.items?.length > 0 : false);
const noConfigs = computed(() => !hasConfigs.value);
const hasServices = ref<boolean>(fetchedServices.value?.items ? fetchedServices.value?.items?.length > 0 : false);
const noServices = computed(() => !hasServices.value);

// const fetchInitialData = async () => {
//   // if there is no namespace, we cannot fetch configurations or services on mount
//   if (!props.application.metadata.namespace) {
//     return;
//   }
//   isFetchingConfigsAndServices.value = true;
//   await fetchConfigurations();
//   await fetchServices();
//   isFetchingConfigsAndServices.value = false;

//   // emit initial bindings now that fetched data is available 
//   if (props.initialApplication?.configuration?.configurations?.length) {
//     const configurationNames = props.initialApplication.configuration.configurations;
//     const bound = fetchedConfigurations.value
//       .filter((c: any) => configurationNames.includes(c.meta.name));

//     values.value.configurations = bound;
//     emit('initial', { configurations: bound });
//   }

//   if (props.initialApplication?.configuration?.services?.length) {
//     const serviceNames = props.initialApplication.configuration.services;
//     const bound = fetchedServices.value
//       .filter((s: any) => serviceNames.includes(s.meta.name));

//     values.value.services = bound;
//     emit('initial', { services: bound });
//   }
// };

// fetch data immediately to populate the value with objects instead of strings
// onMounted(() => {
//   fetchInitialData();
// });

const configurations = computed(() => {
  if (!fetchedConfigurations.value?.items?.length) {
    return [];
  }
  const list = fetchedConfigurations.value?.items
    .filter((c) => { return c.configuration.type !== 'service'; })
    .map((c) => ({ 
      label: c.meta.name,
      value: c.meta.name,
    }));

    return list;
});

const services = computed(() => {
  if (!fetchedServices.value?.items?.length) {
    return [];
  }
  const list = fetchedServices.value?.items.map((s) => ({
    label: `${s.meta.name} (${s.catalogService})`,
    value: `${props.application.metadata.namespace}/${s.meta.name}`,
  }));

  return list;
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
// watch(hasConfigs, (neu) => {
//   if (!neu && values.value.configurations?.length) {
//     values.value.configurations = [];
//   }
//   if (neu && isFromManifest.value) {
//     values.value.configurations = fetchedConfigurations.value
//       .filter((nc: any) =>
//         props.application.configuration.configurations.includes(nc.meta.name)
//       );
//   }
// });

// // if the namespace has no services, clear the values.services array. If it has services and the app is from a manifest, set values.services to the bound services.
// watch(hasServices, (neu) => {
//   if (!neu && values.value.services?.length) {
//     values.value.services = [];
//   }
//   if (neu && isFromManifest.value) {
//     const configurations = fetchedConfigurations.value
//       .filter((nc: any) =>
//         props.application.configuration.configurations.includes(nc.meta.name) &&
//         nc.isServiceRelated
//       );
//     values.value.services = fetchedServices.value?.items
//       .filter((s) => configurations.some((d: any) => s.meta.name === d.configuration.origin));
//   }
// });
</script>

<template>
  <div class="configurations">
    <!-- <ResourceDropdown
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
    /> -->
    <div>
      <trailhand-dropdown
        style="width: 100%"
        :options="configurations"
        :value="values.configurations.filter((c: any) => !c.isServiceRelated).map((c: any) => c.meta.name)"
        :label="t('typeLabel.configurations', { count: 2})"
        :placeholder="noConfigs ? t('epinio.applications.steps.configurations.configurations.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.configurations.select.placeholderWithOptions')"
        :disabled="noConfigs || isView"
        filterable
        multiselect
        @dropdown-change="(e: CustomEvent) => { 
          const serviceRelatedConfigs = values.configurations.filter((c: any) => c.isServiceRelated);
          const selectedConfigs = e.detail.values.map((c: string) => fetchedConfigurations?.items.find((nc) => nc.meta.name === c));
          values.configurations = [...serviceRelatedConfigs, ...selectedConfigs];
        }"
        @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onConfigurationsFilter(e.detail.filter); }"
        :isLoading="isLoadingConfigurations"
      ></trailhand-dropdown>
      <p v-if="isErrorConfigurations" class="error-message">
        {{ t(`epinio.configurations.errors.fetchAll`) }}
      </p>
    </div>
    <!-- <ResourceDropdown
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
    /> -->
    <div>
      <trailhand-dropdown
        style="width: 100%"
        :options="services"
        :value="values.services.map((s: any) => `${props.application.metadata.namespace}/${s.meta.name}`)"
        :label="t('typeLabel.services', { count: 2})"
        :placeholder="noServices ? t('epinio.applications.steps.configurations.services.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.services.select.placeholderWithOptions')"
        :disabled="noServices || isView"
        filterable
        multiselect
        @dropdown-change="(e: CustomEvent) => { values.services = e.detail.value.map((s: string) => fetchedServices?.items.find((ns) => `${props.application.metadata.namespace}/${ns.meta.name}` === s)); }"
        @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onServicesFilter(e.detail.filter); }"
        :isLoading="isLoadingServices"
      ></trailhand-dropdown>
      <p v-if="isErrorServices" class="error-message">
        {{ t(`epinio.services.errors.fetchAll`) }}
      </p>
    </div>
  </div>
</template>

<style lang='scss' scoped>
.configurations {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
