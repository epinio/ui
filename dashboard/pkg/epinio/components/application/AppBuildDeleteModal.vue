<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import { App } from '../../models/application/ui-types';
import { deleteAppBuild } from '../../models/application/actions/restage';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const appToDelete = ref<App | null>(null);
const isDeleting = ref(false);

function openDelete(row: App) {
  appToDelete.value = row;
  showModal.value = true;
}

function closeDelete() {
  if (isDeleting.value) {
    return;
  }

  showModal.value = false;
  appToDelete.value = null;
}

async function onSubmitDelete() {
  if (!appToDelete.value || isDeleting.value) {
    return;
  }

  isDeleting.value = true;

  try {
    await deleteAppBuild(store, appToDelete.value);
    showModal.value = false;
    appToDelete.value = null;
  } catch {
    // Keep the modal open; deleteAppBuild already showed the error growl.
  } finally {
    isDeleting.value = false;
  }
}

defineExpose({ openDelete });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :title="t('epinio.applications.actions.deleteBuild.confirm.title')"
    @modal-close="closeDelete"
  >
    <div class="modal-content">
      <p>
        {{ t('epinio.applications.actions.deleteBuild.confirm.body', { name: appToDelete?.meta?.name }) }}
      </p>
      <p class="warning">
        {{ t('epinio.applications.actions.deleteBuild.confirm.registryWarning') }}
      </p>
      <p>
        {{ t('epinio.applications.actions.deleteBuild.confirm.keepApp') }}
      </p>
    </div>

    <div slot="footer">
      <trailhand-button
        variant="secondary"
        class="mr-10"
        :disabled="isDeleting"
        @button-click="closeDelete"
      >
        {{ t('generic.cancel') }}
      </trailhand-button>
      <trailhand-button
        variant="destructive"
        :disabled="isDeleting"
        @button-click="onSubmitDelete"
      >
        {{ isDeleting ? t('generic.deleting') : t('epinio.applications.actions.deleteBuild.label') }}
      </trailhand-button>
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}

.warning {
  color: var(--error);
  font-weight: 500;
}
</style>
