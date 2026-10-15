<script setup lang="ts">
import ResourceDetail from '@shell/components/ResourceDetail/index.vue';
import { useStore } from 'vuex';

const store = useStore();
const route = store.$router.currentRoute.value;

const isApplication = route.params.resource === 'applications';
</script>

<template>
  <div v-if="isApplication" class="view-application-container">
    <ResourceDetail />
  </div>
  <ResourceDetail v-else />
</template>

<style lang="scss" scoped>
.view-application-container {
  :deep(.title-bar) {
    display: none;
  }
}
</style>
