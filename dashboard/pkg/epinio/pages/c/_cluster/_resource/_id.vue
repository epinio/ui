<script setup lang="ts">
import ResourceDetail from '@shell/components/ResourceDetail/index.vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Determine if the current resource is catalogservices to hide default header and use custom Masthead in the detail component
const isCatalogServices = route.params.resource === 'catalogservices';
</script>


<template>
  <div class="catalogservices-container" v-if="isCatalogServices">
    <ResourceDetail />
  </div>
  <ResourceDetail v-else />
</template>

<style lang="scss" scoped>
.catalogservices-container {
  :deep(.title-bar) {
    display: none;
  }
}
</style>

