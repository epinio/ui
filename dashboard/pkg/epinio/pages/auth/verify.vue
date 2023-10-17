<script lang="ts">
import Vue from 'vue';
import epinioAuth from '../../utils/auth';
import Banner from '@components/Banner/Banner.vue';

interface Data {
  error: string,
}

export default Vue.extend<Data, any, any, any>({

  components: { Banner },

  data() {
    return { error: '' };
  },

  async fetch({ store, route }: { store: any, route: any}) {
    const {
      error, error_description: errorDescription, errorCode, errorMsg
    } = route.query;

    if (error || errorDescription || errorCode || errorMsg) {
      this.error = errorDescription || error || errorCode;

      if (errorMsg) {
        this.error = store.getters['i18n/withFallback'](`login.serverError.${ errorMsg }`, null, errorMsg);
      }

      console.error('Dex indicates failure', error); // eslint-disable-line no-console
    } else {
      await epinioAuth.dexRedirect(route, {
        dexUrl:       document.referrer,
        dashboardUrl: window.origin
      });
    }
  },
});

</script>

<template>
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
