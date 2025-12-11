import { onBeforeRouteLeave } from 'vue-router';
import { ref } from 'vue';
import { useStore } from 'vuex';

export function useUnsavedChangesMixin() {
  const store = useStore();
  const hasUnsavedChanges = ref(false);
  const allowNavigation = ref(false);

  const setUnsavedChanges = (value: boolean) => {
    hasUnsavedChanges.value = value;
  };

  onBeforeRouteLeave((to, from, next) => {
    if (!hasUnsavedChanges.value || allowNavigation.value) {
      next();
      return;
    }

    // Show modal and wait for user decision
    store.dispatch('cluster/promptModal', {
      component: 'UnsavedChangesDialog',
      componentProps: {
        onProceed: () => {
          hasUnsavedChanges.value = false;
          allowNavigation.value = true;
          next();
        },
        onCancel: () => {
          next(false);
        }
      }
    }, { root: true });
  });

  return {
    hasUnsavedChanges,
    setUnsavedChanges,
  };
}
