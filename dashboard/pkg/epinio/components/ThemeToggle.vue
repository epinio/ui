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
    let bodyObserver = null;
    
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
    
    // Apply immediatel
    (() => {
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
    })();
    
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
    
    return { theme };
  }
};
</script>

<template>
  <div class="theme-toggle">
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