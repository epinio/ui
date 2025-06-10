<script setup lang="ts">
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ref, computed, onMounted } from 'vue'

import { EPINIO_TYPES } from '../types'

import Loading from '@shell/components/Loading.vue'
import SelectIconGrid from '@shell/components/SelectIconGrid.vue'

const store = useStore()
const router = useRouter()
const props = defineProps<{ schema: object }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

const pending = ref(true);
const searchQuery = ref(null);

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CATALOG_SERVICE });
  pending.value = false;
})

const list = computed(() => {
  const catalogList = store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE)
  
  if (!searchQuery.value) {
    return catalogList;
  } else {
    const query = searchQuery.value.toLowerCase();

    return catalogList.filter((e) => e?.chart.toLowerCase().includes(query) || 
      e?.description.toLowerCase().includes(query) || 
      e?.short_description.toLowerCase().includes(query));
  }
})

const showDetails = (chart: any) => {
  router.push(chart.detailLocation)
}

const colorFor = () => {
  return `color-1`
}
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <div class="filter-block">
      <input
        v-model="searchQuery"
        type="search"
        class="input-sm"
        :placeholder="t('catalog.charts.search')"
      >
    </div>

    <SelectIconGrid
      :rows="list"
      :color-for="colorFor"
      name-field="name"
      icon-field="serviceIcon"
      key-field="name"
      description-field="short_description"
      @clicked="(row) => showDetails(row)"
    />
  </div>
</template>

<style lang="scss" scoped>
.filter-block {
  display: flex;
  justify-content: flex-end;
  input {
    width: 315px;
  }
}
</style>
