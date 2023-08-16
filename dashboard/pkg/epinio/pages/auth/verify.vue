<script lang="ts">
import epinioAuth from '../../utils/auth';

export default {
  layout: 'unauthenticated',

  async fetch({ store, route, redirect }) {
    debugger;
    try {
      await epinioAuth.dexRedirect(route, {
        dexUrl:       `https://auth.46.101.17.26.nip.io`, // TODO: RC from config
        dashboardUrl: 'https://localhost:8005' // TODO: RC get current url
      });
      // await oidcUserManager.signinRedirectCallback(route.url);
    } catch (e) {
      console.error('token warning', e); // TODO: RC handle. in theory should be rejected promise in calling code?
      // reply(e, 500); // TODO: RC
    }

    // reply(null, 200);
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
