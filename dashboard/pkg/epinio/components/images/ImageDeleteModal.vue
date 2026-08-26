<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteBuilderImage } from '../../queries/useBuilderImagesMutations';
import { BuilderImage } from '../../models/builderimage/ui-types';

const showDeleteModal = ref<boolean>(false);
const imageToDelete = ref<BuilderImage | null>(null);
const errors = ref<Array<string>>([]);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

const {mutate: deleteBuilderImage, isPending: isDeletingBuilderImage, isError: deleteBuilderImageError, error: deleteBuilderImageErrorData} = useDeleteBuilderImage(store, handleSuccess);

function openDelete(row: BuilderImage) {
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
    deleteBuilderImage({ name: imageName });
}

function handleSuccess() {
    store.dispatch('growl/success', {
        title:   t('epinio.growl.builderImages.delete.success.title'),
        message: t('epinio.growl.builderImages.delete.success.message', { name: imageToDelete.value?.meta.name }),
    });
    emit('deleted');
    closeDelete();
};
const emit = defineEmits(['deleted']);
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
            v-if="deleteBuilderImageError"
            color="error"
            :label="deleteBuilderImageErrorData?.message || t('epinio.builderImages.errors.delete')"
        />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="isDeletingBuilderImage" variant="destructive" @button-click="onSubmitDelete"
            >{{ isDeletingBuilderImage ? t('generic.deleting') : t('generic.delete') }}</trailhand-button
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