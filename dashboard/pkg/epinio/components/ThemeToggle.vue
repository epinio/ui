<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useStore } from 'vuex';
import { ToggleSwitch } from '@shell/rancher-components/Form/ToggleSwitch';

export default {
  name: 'ThemeToggle',
  components: { ToggleSwitch },

  setup() {
    const store = useStore();
    const localStorageKey = 'user-theme-preference';
    const isDark = ref(false);
    const isEpinioSingleProduct = process.env.rancherEnv === 'epinio';
    let bodyObserver = null;

    // Standalone owns its own theme, and everything below runs only there.
    // Shell loads server-side prefs solely when talking to Rancher, so
    // localStorage is the only store that survives a refresh, and the body
    // class has to be re-applied whenever Shell resets it. As a Rancher
    // extension none of this runs: Rancher's own preference is authoritative
    // and config/epinio.ts mirrors it. Writing it from here overwrote the
    // user's Rancher theme setting on login.

    // Apply theme
    const applyTheme = (themeName) => {
      // Update DOM
      document.documentElement.setAttribute('data-theme', themeName);
      document.body.setAttribute('data-theme', themeName);

      // Update body class
      const body = document.body;
      body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) body.classList.remove(cls);
      });
      body.classList.add(`theme-${themeName}`);

      // Update store
      store.dispatch('prefs/set', { key: 'theme', value: themeName });
    };

    // Apply immediately, before mount, so the page doesn't flash the wrong theme
    if (isEpinioSingleProduct) {
      const savedTheme = localStorage.getItem(localStorageKey);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.classList.forEach(cls => {
          if (cls.startsWith('theme-')) document.body.classList.remove(cls);
        });
        document.body.classList.add(`theme-${savedTheme}`);

        setTimeout(() => {
          store.dispatch('prefs/set', { key: 'theme', value: savedTheme });
        }, 0);
      }
    }

    // Initialize theme
    const initTheme = () => {
      const savedTheme = localStorage.getItem(localStorageKey);

      if (savedTheme === 'dark' || savedTheme === 'light') {
        isDark.value = savedTheme === 'dark';
      } else {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        isDark.value = prefersDark;
        localStorage.setItem(localStorageKey, prefersDark ? 'dark' : 'light');
      }

      applyTheme(isDark.value ? 'dark' : 'light');
    };

    onMounted(() => {
      if (!isEpinioSingleProduct) {
        return;
      }

      initTheme();
      // Watch for class changes
      bodyObserver = new MutationObserver(() => {
        const currentTheme = isDark.value ? 'dark' : 'light';
        if (!document.body.classList.contains(`theme-${currentTheme}`)) {
          applyTheme(currentTheme);
        }
      });

      bodyObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    });

    onUnmounted(() => {
      if (bodyObserver) bodyObserver.disconnect();
    });

    // Toggle theme
    const theme = computed({
      get: () => isDark.value,
      set: (value) => {
        isDark.value = value;
        const newTheme = value ? 'dark' : 'light';
        localStorage.setItem(localStorageKey, newTheme);
        applyTheme(newTheme);
      }
    });

    return { theme, isEpinioSingleProduct };
  }
};
</script>

<template>
  <div v-if="isEpinioSingleProduct" class="theme-toggle">
    <ToggleSwitch
      v-model:value="theme"
      :on-label="'Dark'"
      :off-label="'Light'"
    />
  </div>
</template>

<style lang="scss" scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  margin-right: 10px;
}
</style>
