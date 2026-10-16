<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteApplication, useBulkRemoveApplications } from '../../queries/useApplicationMutations';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const {mutate: deleteApplication, isPending: isDeletingApplication, isError: deleteApplicationError, error: deleteApplicationErrorData} = useDeleteApplication(store, handleSuccess);

const showModal = ref(false);
const appToDelete = ref<any>(null);
const errors = ref<string[]>([]);
const deleteFromRegistry = ref(false);
const deletePVC = ref(false);

function openDelete(row: any) {
  appToDelete.value = row;
  errors.value = [];
  showModal.value = true;
}

function closeDelete() {
  showModal.value = false;
  deleteFromRegistry.value = false;
  deletePVC.value = false;
  errors.value = [];
  appToDelete.value = null;
}

async function onSubmitDelete() {
  if (!appToDelete.value) return;

    const appName = appToDelete.value.meta.name;
    const appNamespace = appToDelete.value.meta.namespace;
    deleteApplication({ namespace: appNamespace, app: appName, body: { deleteImage: deleteFromRegistry.value, deletePVC: deletePVC.value, unmounted: true } });
}

function handleSuccess() {
  store.dispatch('growl/success', {
    title:   t('epinio.growl.application.delete.success.title'),
    message: t('epinio.growl.application.delete.success.message', { name: appToDelete.value?.meta.name }),
  });
  closeDelete();
}

defineExpose({ openDelete });
const emit = defineEmits(['deleted']);
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    title="Are you sure?"
    @modal-close="closeDelete"
  >
    <div class="modal-content">
      <p>You are attempting to delete the application <strong>{{ appToDelete?.meta?.name }}</strong>.</p>
      <trailhand-checkbox
        :value="deleteFromRegistry"
        :checked="deleteFromRegistry"
        @checkbox-change="(e: CustomEvent<{ checked: boolean }>) => { deleteFromRegistry = e.detail.checked; }"
      >Remove the application's container image from registry</trailhand-checkbox>
      <trailhand-checkbox
        :value="deletePVC"
        :checked="deletePVC"
        @checkbox-change="(e: CustomEvent<{ checked: boolean }>) => { deletePVC = e.detail.checked; }"
      >Delete the application's persistent storage</trailhand-checkbox>
        <Banner
          v-if="deleteApplicationError"
          color="error"
          :label="deleteApplicationErrorData?.message || t('epinio.application.errors.delete')"
        />
    </div>

    <div slot="footer">
      <trailhand-button
        variant="secondary"
        class="mr-10"
        @button-click="closeDelete"
      >
        Cancel
      </trailhand-button>
      <trailhand-button
        variant="destructive"
        :disabled="isDeletingApplication"
        @button-click="onSubmitDelete"
      >
        {{ isDeletingApplication ? t('generic.deleting') : t('generic.delete') }}
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
</style>
