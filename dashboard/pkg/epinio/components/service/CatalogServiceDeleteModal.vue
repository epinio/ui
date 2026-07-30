<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import EpinioCatalogServiceModel from 'models/catalogservices';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const showDeleteModal = ref<boolean>(false);
const catalogServiceToDelete = ref<EpinioCatalogServiceModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingCatalogService = ref<boolean>(false);
const hasAssociatedServices = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

function openDelete(row: EpinioCatalogServiceModel) {
  catalogServiceToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedServices.value = !!row.bound_services;
}

function closeDelete() {
showDeleteModal.value = false;
errors.value = [];
hasAssociatedServices.value = false;
catalogServiceToDelete.value = null;
}

async function onSubmitDelete() {
if (!catalogServiceToDelete.value) {
    return;
}
const catalogServiceName = catalogServiceToDelete.value.meta.name;
try {
    deletingCatalogService.value = true;
    await catalogServiceToDelete.value.remove();
    store.dispatch('growl/success', {
      title:   t('epinio.growl.catalogServices.delete.success.title'),
      message: t('epinio.growl.catalogServices.delete.success.message', { name: catalogServiceName }),
    });
    closeDelete();
    emit('deleted');
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE, opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.catalogServices.delete.error.title'),
      message: t('epinio.growl.catalogServices.delete.error.message', { name: catalogServiceName }),
    });
} finally {
    deletingCatalogService.value = false;
}
}
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
            v-for="(err, i) in errors"
            :key="i"
            color="error"
            :label="err"
            />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="deletingCatalogService" variant="destructive" @button-click="onSubmitDelete"
            >{{ deletingCatalogService ? 'Deleting...' : t('generic.delete') }}</trailhand-button
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