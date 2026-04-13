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
try {
    deletingService.value = true;
    await serviceToDelete.value.remove();
    closeDelete();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.SERVICE_INSTANCE, opt: { force: true } });
    store.dispatch('findAll', { type: 'applications', opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
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
        <trailhand-button @button-click="closeDelete" variant="secondary" class="mr-10"
            >Cancel</trailhand-button
        >
        <trailhand-button @button-click="onSubmitDelete" :disabled="deletingService" variant="destructive"
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