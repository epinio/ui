<script setup lang="ts">

import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { _VIEW } from '@shell/config/query-params';
import { EPINIO_APP_MANIFEST } from '../../types';
import { ListResourceRequestParams, ResourceQueryOptions } from '../../models/resource/ui-types';
import { useServices } from '../../queries/useServiceQueries';
import { useConfigurations } from '../../queries/useConfigurationQueries';
import { debounce } from 'lodash';
import { AppFormBindings } from 'models/application/ui-types';

interface Props {
  bindings: AppFormBindings;
  namespace: string;
  mode: string;
  active: boolean;
  updateBindings: (newBindings: Partial<AppFormBindings>) => void;
}

const props = defineProps<Props>();
// 'initial' reports what was bound when the form opened, so the parent can diff
// against it on save instead of re-deriving it from the store.
const emit = defineEmits(['change', 'initial']);

const store = useStore();

const t = store.getters['i18n/t'];

watch(() => props.namespace, (newNamespace) => {
  requestParams.value.namespaces = newNamespace ? [newNamespace] : [];
  requestOptions.value.enabled = !!newNamespace;
});

const requestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 10,
  search: '',
});
const requestOptions = ref<ResourceQueryOptions>({
  enabled: false,
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

const hasConfigs = computed(() => fetchedConfigurations.value?.items ? fetchedConfigurations.value?.items?.length > 0 : false);
const noConfigs = computed(() => !hasConfigs.value);
const hasServices = computed(() => fetchedServices.value?.items ? fetchedServices.value?.items?.length > 0 : false);
const noServices = computed(() => !hasServices.value);

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
    value: `${props.namespace}/${s.meta.name}`,
  }));

  return list;
});

const isFromManifest = computed(
  () => store.$router.currentRoute._value.query.from === EPINIO_APP_MANIFEST
);
</script>

<template>
  <div class="configurations">
    <div>
      <trailhand-dropdown
        style="width: 100%"
        :options="configurations"
        :value="bindings.configurations"
        :label="t('typeLabel.configurations', { count: 2})"
        :placeholder="noConfigs ? t('epinio.applications.steps.configurations.configurations.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.configurations.select.placeholderWithOptions')"
        :disabled="noConfigs"
        filterable
        multiselect
        @dropdown-change="(e: CustomEvent) => { 
          updateBindings({ configurations: e.detail.values });
        }"
        @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onConfigurationsFilter(e.detail.filter); }"
        :isLoading="isLoadingConfigurations"
      ></trailhand-dropdown>
      <p v-if="isErrorConfigurations" class="error-message">
        {{ t(`epinio.configurations.errors.fetchAll`) }}
      </p>
    </div>
    <div>
      <trailhand-dropdown
        style="width: 100%"
        :options="services"
        :value="bindings.services.map((s) => `${namespace}/${s}`)"
        :label="t('typeLabel.services', { count: 2})"
        :placeholder="noServices ? t('epinio.applications.steps.configurations.services.select.placeholderNoOptions') : t('epinio.applications.steps.configurations.services.select.placeholderWithOptions')"
        :disabled="noServices"
        filterable
        multiselect
        @dropdown-change="(e: CustomEvent) => { updateBindings({ services: e.detail.value.map((s: string) => s.replace(`${namespace}/`, '')) }); }"
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
