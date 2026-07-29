<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import EpinioServiceModel from 'models/services';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const showDeleteModal = ref<boolean>(false);
const serviceToDelete = ref<EpinioServiceModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingService = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

function openDelete(row: EpinioServiceModel) {
  serviceToDelete.value = row;
  showDeleteModal.value = true;
}

function closeDelete() {
showDeleteModal.value = false;
errors.value = [];
}

async function onSubmitDelete() {
if (!serviceToDelete.value) {
    return;
}
const serviceName = serviceToDelete.value.meta.name;

try {
    deletingService.value = true;
    await serviceToDelete.value.remove();
    closeDelete();
    store.dispatch('growl/success', {
      title:   t('epinio.growl.serviceInstance.delete.success.title'),
      message: t('epinio.growl.serviceInstance.delete.success.message', { name: serviceName }),
    });
    store.dispatch('epinio/refreshList', { type: EPINIO_TYPES.SERVICE_INSTANCE });
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP, opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.serviceInstance.delete.error.title'),
      message: t('epinio.growl.serviceInstance.delete.error.message', { name: serviceName }),
    });
} finally {
    deletingService.value = false;
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
        <p>You are attempting to delete the Instance <strong>{{ serviceToDelete?.meta.name }}</strong>.</p>
        <div v-if="(serviceToDelete as any)?.boundapps?.length">
            <p><strong>Caution: </strong>The following applications are bound to the Service Instance about to be deleted. Proceeding will unbind them prior to deletion.</p>
            <ul>
            <li v-for="app in (serviceToDelete as any)?.boundapps || []" :key="app">{{ app }}</li>
            </ul>
        </div>
        <p v-else>No applications are bound to this Service Instance.</p>
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
        <trailhand-button :disabled="deletingService" variant="destructive" @button-click="onSubmitDelete"
            >{{ deletingService ? 'Deleting...' : t('generic.delete') }}</trailhand-button
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