<script>
import { computed, defineComponent } from 'vue';
import { useStore } from 'vuex';
import { ToggleSwitch } from '@shell/rancher-components/Form/ToggleSwitch';

export default defineComponent({
  name: 'ThemeToggle',
  components: { ToggleSwitch },
  setup() {
    const store = useStore();
    const localStorageKey = 'user-theme-preference';
    
    // Apply them from localStorage execution and runs before the component mountss
    (function applyStoredThemeImmediately() {
      const savedTheme = localStorage.getItem(localStorageKey);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        // apply right away
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${savedTheme}`;
        
        // set in store to avoid blocking
        setTimeout(() => {
          store.dispatch('prefs/set', {
            key: 'theme',
            value: savedTheme
          });
        }, 0);
      }
    })();
    
    // apply theme
    const applyThemeToDocument = (themeName) => {
      // Apply to html element
      document.documentElement.setAttribute('data-theme', themeName);
      
      // Apply to body class
      const body = document.body;
      // Remove any existing theme classes
      body.className = body.className.replace(/theme-\w+/g, '').trim();
      // Add new theme class
      body.className += ` theme-${themeName}`;
      
      // Set CSS variable for current theme
      document.documentElement.style.setProperty('--current-theme', themeName);
    };
    
    // Handle theme toggle
    const theme = computed({
      get() {
        // check localStorage 1st for the source of truth
        const savedTheme = localStorage.getItem(localStorageKey);
        if (savedTheme === 'dark' || savedTheme === 'light') {
          return savedTheme === 'dark';
        }
        
        // Fall back to store only if localStorage is empty
        const storeTheme = store.getters['prefs/theme'] || 'light';
        return storeTheme === 'dark';
      },
      
      set(value) {
        // Determine new theme based on toggle value
        const newTheme = value ? 'dark' : 'light';
        
        // Save to localStorage
        localStorage.setItem(localStorageKey, newTheme);
        
        // Apply the theme visually
        applyThemeToDocument(newTheme);
        
        // Update in store
        store.dispatch('prefs/set', {
          key: 'theme',
          value: newTheme
        });
      }
    });
    
    return { theme };
  }
});
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