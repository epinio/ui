<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { CatalogService } from '../../models/catalogservice/ui-types';
import { useDeleteCatalogService } from '../../queries/useCatalogServiceMutation';

const showDeleteModal = ref<boolean>(false);
const catalogServiceToDelete = ref<CatalogService | null>(null);
const hasAssociatedServices = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

const {mutate: deleteCatalogService, isPending: isDeletingCatalogService, isError: deleteCatalogServiceError, error: deleteCatalogServiceErrorData} = useDeleteCatalogService(store, handleSuccess);

function openDelete(row: CatalogService) {
  catalogServiceToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedServices.value = !!row.boundServices;
}

function closeDelete() {
    showDeleteModal.value = false;
    hasAssociatedServices.value = false;
    catalogServiceToDelete.value = null;
}

async function onSubmitDelete() {
    if (!catalogServiceToDelete.value) {
        return;
    }
    const catalogServiceName = catalogServiceToDelete.value.meta.name;
    deleteCatalogService({ name: catalogServiceName });
}

function handleSuccess() {
    store.dispatch('growl/success', {
        title:   t('epinio.growl.catalogServices.delete.success.title'),
        message: t('epinio.growl.catalogServices.delete.success.message', { name: catalogServiceToDelete.value?.meta.name }),
    });
    emit('deleted');
    closeDelete();
};

defineExpose({
  openDelete
});

const emit = defineEmits(['deleted']);
</script> 

<template>
    <trailhand-modal
        :open.prop="showDeleteModal"
        title="Are you sure?"
        @modal-close="closeDelete"
    >
        <div class="modal-content">
        <p>You are attempting to delete the Catalog Service <strong>{{ catalogServiceToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedServices" color="warning" label="This catalog service is currently associated with one or more services. Deleting it may affect those services." />
        <Banner
            v-if="deleteCatalogServiceError"
            color="error"
            :label="deleteCatalogServiceErrorData?.message || t('epinio.catalogService.errors.delete')"
        />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="isDeletingCatalogService" variant="destructive" @button-click="onSubmitDelete"
            >{{ isDeletingCatalogService ? t('generic.deleting') : t('generic.delete') }}</trailhand-button
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