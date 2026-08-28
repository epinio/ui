<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const appToDelete = ref<any>(null);
const deleting = ref(false);
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

  deleting.value = true;
  errors.value = [];
  const appName = appToDelete.value.meta.name;

  try {
    if (deleteFromRegistry.value) {
      appToDelete.value._deleteImage = true;
    }

    if (deletePVC.value) {
      appToDelete.value._deletePVC = true;
    }

    await appToDelete.value.remove();
    emit('deleted', appToDelete.value);
    closeDelete();
    store.dispatch('growl/success', {
      title:   t('epinio.growl.application.delete.success.title'),
      message: t('epinio.growl.application.delete.success.message', { name: appName }),
    });
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP, opt: { force: true } });
  } catch (e: any) {
    errors.value = epinioExceptionToErrorsArray(e);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.application.delete.error.title'),
      message: t('epinio.growl.application.delete.error.message', { name: appName, error: e instanceof Error ? e.message : String(e) }),
    });
  } finally {
    deleting.value = false;
  }
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
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
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
        :disabled="deleting"
        @button-click="onSubmitDelete"
      >
        {{ deleting ? t('generic.deleting') : t('generic.delete') }}
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
