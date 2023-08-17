<script lang="ts">
import epinioAuth from '../../utils/auth';

export default {
  layout: 'unauthenticated',

  async fetch({ store, route }) {
    try {
      const {
        error, error_description: errorDescription, errorCode, errorMsg
      } = route.query;

      if (error || errorDescription || errorCode || errorMsg) {
        let out = errorDescription || error || errorCode;

        if (errorMsg) {
          out = store.getters['i18n/withFallback'](`login.serverError.${ errorMsg }`, null, errorMsg);
        }

        throw new Error(out);
      }

      await epinioAuth.dexRedirect(route, {
        dexUrl:       document.referrer,
        dashboardUrl: window.origin
      });
    } catch (e) {
      console.error('token warning', e); // TODO: RC display out in error bar
    }
  },

};
</script>

<template>
  <main class="main-layout">
    <h1 class="text-center mt-50">
      Logging In&hellip;
    </h1>
  </main>
</template>
