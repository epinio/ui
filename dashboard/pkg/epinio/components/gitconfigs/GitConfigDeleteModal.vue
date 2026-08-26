<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteGitConfig } from '../../queries/useGitConfigMutations';
import { GitConfig } from '../../models/gitconfig/ui-types';

const showDeleteModal = ref<boolean>(false);
const gitConfigToDelete = ref<GitConfig | null>(null);
const errors = ref<Array<string>>([]);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

const {mutate: deleteGitConfig, isPending: isDeletingGitConfig, isError: deleteGitConfigError, error: deleteGitConfigErrorData} = useDeleteGitConfig(store, handleSuccess);

function openDelete(row: GitConfig) {
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
    const gitConfigName = gitConfigToDelete.value.meta.name;
    deleteGitConfig({ name: gitConfigName });
}

function handleSuccess() {
    store.dispatch('growl/success', {
        title:   t('epinio.growl.gitConfigs.delete.success.title'),
        message: t('epinio.growl.gitConfigs.delete.success.message', { name: gitConfigToDelete.value?.meta.name }),
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
        <p>You are attempting to delete the Git Config <strong>{{ gitConfigToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedApps" color="warning" label="This Git Config is currently associated with one or more applications. Deleting it will prevent future rebuilds." />
        <Banner
            v-if="deleteGitConfigError"
            color="error"
            :label="deleteGitConfigErrorData?.message || t('epinio.gitConfigs.errors.delete')"
        />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="isDeletingGitConfig" variant="destructive" @button-click="onSubmitDelete"
            >{{ isDeletingGitConfig ? t('generic.deleting') : t('generic.delete') }}</trailhand-button
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