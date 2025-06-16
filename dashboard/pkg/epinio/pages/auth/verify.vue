<script setup lang="ts">
import { useStore } from 'vuex';
import { ref, onMounted } from 'vue';
import epinioAuth from '../../utils/auth';
import Banner from '@components/Banner/Banner.vue';
import { dashboardUrl } from '../../utils/embedded-helpers';

const store = useStore();
const error = ref<string>('');

onMounted(async () => {
  const { error: routeError, error_description: errorDescription } = route.query;
  
  error.value = errorDescription || routeError;

  if (error.value) {
    console.error('Dex indicates failure', error);
  } else {
    await epinioAuth.dexRedirect(store.$router.currentRoute, {
      dexUrl:       document.referrer,
      dashboardUrl: dashboardUrl()
    });
  }
});
</script>

<template>
  {{error}}
  <main class="main-layout">
    <Banner
      v-if="error"
      color="error"
      :label="error"
    />
    <h1 class="text-center mt-50">
      Logging In&hellip;
    </h1>
  </main>
</template>
