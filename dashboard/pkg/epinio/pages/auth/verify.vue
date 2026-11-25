<script setup lang="ts">
/**
 * Legacy Dex popup callback route.
 * OIDC callback is now handled by the Epinio server at
 * GET /api/v1/auth/oidc/callback (EPINIO-837). Keep this page as a soft redirect.
 */
import { onMounted } from 'vue';
import { useStore } from 'vuex';
import epinioAuth from '../../utils/auth';

const store = useStore();

onMounted(async () => {
  try {
    const me = await fetch('/api/v1/me', { credentials: 'include' });

    if (me.ok) {
      await epinioAuth.syncShellSession();
      await store.dispatch('auth/getUserPrincipal');
      store.$router.replace('/');

      return;
    }
  } catch {
    // fall through
  }

  // No server session — start OIDC on the Epinio server.
  window.location.assign('/api/v1/auth/oidc/start');
});
</script>

<template>
  <main class="main-layout">
    <h1 class="text-center mt-50">
      Logging In&hellip;
    </h1>
  </main>
</template>
