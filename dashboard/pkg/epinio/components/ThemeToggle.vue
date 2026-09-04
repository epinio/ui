<script>
import { ref, onMounted, computed } from 'vue';
import { useStore } from 'vuex';
import { ToggleSwitch } from '@shell/rancher-components/Form/ToggleSwitch';

export default {
  name: 'ThemeToggle',
  components: { ToggleSwitch },

  setup() {
    const store = useStore();
    const localStorageKey = 'user-theme-preference';
    const isDark = ref(false);

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
      initTheme();
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

    const isEpinioSingleProduct = process.env.rancherEnv === "epinio";

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