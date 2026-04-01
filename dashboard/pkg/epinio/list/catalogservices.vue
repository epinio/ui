<script setup lang="ts">
import { useStore } from 'vuex'
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { EPINIO_TYPES } from '../types'

import Loading from '@shell/components/Loading.vue'
import SelectIconGrid from '@shell/components/SelectIconGrid.vue'
import { startPolling, stopPolling } from '../utils/polling';

const store = useStore()
const props = defineProps<{ schema: object }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

const pending = ref(true);
const searchQuery = ref(null);

const serviceIconMap = {
  'mongodb': new URL('../assets/icons/mongodb.png', import.meta.url).href,
  'mysql': new URL('../assets/icons/mysql.png', import.meta.url).href,
  'postgresql': new URL('../assets/icons/postgresql.png', import.meta.url).href,
  'rabbitmq': new URL('../assets/icons/rabbitmq.png', import.meta.url).href,  
  'redis': new URL('../assets/icons/redis.png', import.meta.url).href,
}

onMounted(async () => {
  await store.dispatch(`epinio/findAll`, { type: EPINIO_TYPES.CATALOG_SERVICE });
  pending.value = false;

  startPolling(["namespaces", "applications", "catalogservices", "services"], store);
});

onUnmounted(() => {
  stopPolling(["namespaces", "applications", "catalogservices", "services"]);
});

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
  store.$router.push(chart.detailLocation)
}

const colorFor = () => {
  return `color-1`
}
</script>

<template>
  <Loading v-if="pending" />
  <div v-else>
    <div class="filter-block" id="modal-container-element">
      <trailhand-text-input
        v-model="searchQuery"
        type="search"
        class="input-sm"
        :placeholder="t('catalog.charts.search')"
      />
    </div>

    <div class="cards-container">
      <trailhand-card
        v-for="service in list"
        :key="service.id"
        :card-title="service.meta.name"
        :description="service.short_description"
        :icon-src="serviceIconMap[service.chart] || null"
        :icon-name="serviceIconMap[service.chart] ? null : 'database'"
        clickable
        @click="showDetails(service)"
      >
    </trailhand-card>
    </div>
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

.cards-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 992px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(1, 1fr);
  }
}
</style>
