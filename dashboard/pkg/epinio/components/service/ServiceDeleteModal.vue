<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { ServiceInstance } from '../../models/service/ui-types';
import { useDeleteServiceInstance } from '../../queries/useServiceMutations';
import { useUnbindServiceInstance } from '../../queries/useServiceMutations';

const showDeleteModal = ref<boolean>(false);
const serviceToDelete = ref<ServiceInstance | null>(null);

const store = useStore();
const t = store.getters['i18n/t'];

const {mutate: deleteServiceInstance, isPending: isDeletingServiceInstance, isError: deleteServiceInstanceError, error: deleteServiceInstanceErrorData} = useDeleteServiceInstance(store, handleSuccess);
const {mutateAsync: unbindService, isPending: isUnbindingService, isError: unbindServiceError, error: unbindServiceErrorData} = useUnbindServiceInstance(store);

function openDelete(row: ServiceInstance) {
  serviceToDelete.value = row;
  showDeleteModal.value = true;
}

function closeDelete() {
  showDeleteModal.value = false;
  serviceToDelete.value = null;
}

async function onSubmitDelete() {
    if (!serviceToDelete.value) {
        return;
    }
    if (serviceToDelete.value.boundApps?.length) {
        Promise.all([...serviceToDelete.value.boundApps.map(appName => unbindService({ namespace: serviceToDelete.value!.meta.namespace, serviceName: serviceToDelete.value!.meta.name, request: { appName } }))])
            .then(() => {
                deleteServiceInstance({ namespace: serviceToDelete.value!.meta.namespace, serviceName: serviceToDelete.value!.meta.name });
            })
            .catch((error) => {
                store.dispatch('growl/error', {
                    title: t('epinio.services.errors.unbind.error.title'),
                    message: error?.message || t('epinio.services.errors.unbind.error.message'),
                });
            });
    } else {
        deleteServiceInstance({ namespace: serviceToDelete.value.meta.namespace, serviceName: serviceToDelete.value.meta.name });
    }
}

function handleSuccess() {
  store.dispatch('growl/success', {
    title:   t('epinio.growl.serviceInstance.delete.success.title'),
    message: t('epinio.growl.serviceInstance.delete.success.message', { name: serviceToDelete.value?.meta.name }),
  });
  closeDelete();
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
        <div v-if="serviceToDelete?.boundApps?.length">
            <p><strong>Caution: </strong>The following applications are bound to the Service Instance about to be deleted. Proceeding will unbind them prior to deletion.</p>
            <ul>
            <li v-for="app in serviceToDelete?.boundApps || []" :key="app">{{ app }}</li>
            </ul>
        </div>
        <p v-else>No applications are bound to this Service Instance.</p>
        <Banner
            v-if="unbindServiceError"
            color="error"
            :label="unbindServiceErrorData?.message || t('epinio.services.errors.unbind')"
        />
        <Banner
            v-if="deleteServiceInstanceError"
            color="error"
            :label="deleteServiceInstanceErrorData?.message || t('epinio.services.errors.delete')"
        />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="isDeletingServiceInstance || isUnbindingService" variant="destructive" @button-click="onSubmitDelete"
            >{{ isDeletingServiceInstance || isUnbindingService ? t('generic.deleting') : t('generic.delete') }}</trailhand-button
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