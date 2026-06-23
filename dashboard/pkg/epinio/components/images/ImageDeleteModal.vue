<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';
import EpinioBuilderImageModel from 'models/builderimages';

const showDeleteModal = ref<boolean>(false);
const imageToDelete = ref<EpinioBuilderImageModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingImage = ref<boolean>(false);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

function openDelete(row: EpinioBuilderImageModel) {
  imageToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedApps.value = !!row.boundApps;
}

function closeDelete() {
showDeleteModal.value = false;
errors.value = [];
hasAssociatedApps.value = false;
imageToDelete.value = null;
}

async function onSubmitDelete() {
if (!imageToDelete.value) {
    return;
}
const imageName = imageToDelete.value.meta.name;
try {
    deletingImage.value = true;
    await imageToDelete.value.remove();
    store.dispatch('growl/success', {
      title:   t('epinio.growl.builderImages.delete.success.title'),
      message: t('epinio.growl.builderImages.delete.success.message', { name: imageName }),
    });
    closeDelete();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.BUILDER_IMAGE, opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.builderImages.delete.error.title'),
      message: t('epinio.growl.builderImages.delete.error.message', { name: imageName }),
    });
} finally {
    deletingImage.value = false;
}
}
defineExpose({
  openDelete
});
</script> 

<template>
    <trailhand-modal
        :open.prop="showDeleteModal"
        title="Are you sure?"
        @modal-close="closeDelete"
    >
        <div class="modal-content">
        <p>You are attempting to delete the Image <strong>{{ imageToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedApps" color="warning" label="This image is currently associated with one or more applications. Deleting it will prevent future rebuilds." />
        <Banner
            v-for="(err, i) in errors"
            :key="i"
            color="error"
            :label="err"
            />
        </div>
        <div slot="footer">
        <trailhand-button @button-click="closeDelete" variant="secondary" class="mr-10"
            >Cancel</trailhand-button
        >
        <trailhand-button @button-click="onSubmitDelete" :disabled="deletingImage" variant="destructive"
            >{{ deletingImage ? 'Deleting...' : t('generic.delete') }}</trailhand-button
        >
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