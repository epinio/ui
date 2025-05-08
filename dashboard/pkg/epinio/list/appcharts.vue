<script setup lang="ts">
import { EPINIO_TYPES } from '../types';
import { useStore } from 'vuex';
import ResourceTable from '@shell/components/ResourceTable';
import { ref, onMounted, computed, watch, nextTick, useAttrs } from 'vue';

const pending = ref<boolean>(true);
const props = defineProps<{
  schema: object,
}>();

const store = useStore();
const attrs = useAttrs();

onMounted(async () => {
  await store.dispatch(
    `epinio/findAll`, 
    { type: EPINIO_TYPES.APP_CHARTS }
  );
  pending.value = false;
});

const rows = computed(() => {
  return store.getters['epinio/all'](EPINIO_TYPES.APP_CHARTS);
});
</script>

<template>
  <ResourceTable
    v-bind="attrs"
    :rows="rows"
    :schema="schema"
    :loading="pending"
    :table-actions="false"
  />
</template>
