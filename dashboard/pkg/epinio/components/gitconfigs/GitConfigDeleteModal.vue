<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';
import EpinioGitConfigModel from 'models/gitconfigs';

const showDeleteModal = ref<boolean>(false);
const gitConfigToDelete = ref<EpinioGitConfigModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingGitConfig = ref<boolean>(false);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();

function openDelete(row: EpinioGitConfigModel) {
  gitConfigToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedApps.value = !!row.boundApps;
}

function closeDelete() {
showDeleteModal.value = false;
errors.value = [];
hasAssociatedApps.value = false;
gitConfigToDelete.value = null;
}

async function onSubmitDelete() {
if (!gitConfigToDelete.value) {
    return;
}
try {
    deletingGitConfig.value = true;
    await gitConfigToDelete.value.remove();
    closeDelete();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.GIT_CONFIG, opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
} finally {
    deletingGitConfig.value = false;
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
        <p>You are attempting to delete the Git Config <strong>{{ gitConfigToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedApps" color="warning" label="This Git Config is currently associated with one or more applications. Deleting it will prevent future rebuilds." />
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
        <trailhand-button @button-click="onSubmitDelete" :disabled="deletingGitConfig" variant="destructive"
            >{{ deletingGitConfig ? 'Deleting...' : t('generic.delete') }}</trailhand-button
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