<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useStore } from 'vuex';

import ResourceTable from '@shell/components/ResourceTable.vue';
import EpinioCatalogServiceModel from '../models/catalogservices';
import { EPINIO_PRODUCT_NAME, EPINIO_TYPES } from '../types';

const props = defineProps<{
  value: EpinioCatalogServiceModel
}>();

const store = useStore();

const servicesSchema = ref();
const servicesHeaders = ref<any[]>([]); // Adjust the type if headers are more specific

const loading = ref(true);

onMounted(async () => {
  await store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE });

  servicesSchema.value = store.getters[`${EPINIO_PRODUCT_NAME}/schemaFor`](EPINIO_TYPES.SERVICE_INSTANCE);
  servicesHeaders.value = store.getters['type-map/headersFor'](servicesSchema.value);

  loading.value = false;
});
</script>

<template>
  <div>
    <h2 class="mt-20">
      {{ t('epinio.catalogService.detail.servicesTitle', { catalogService: props.value.name }) }}
    </h2>
    <ResourceTable
      :schema="servicesSchema"
      :rows="props.value.services"
      :loading="loading"
      :headers="servicesHeaders"
    />
  </div>
</template>
