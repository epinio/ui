<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { useDeleteAppChart } from '../../queries/useAppChartsMutations';
import { AppChart } from '../../models/appcharts/ui-types';

const showDeleteModal = ref<boolean>(false);
const chartToDelete = ref<AppChart | null>(null);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

const {mutate: deleteAppChart, isPending: isDeletingAppChart, isError: deleteAppChartError, error: deleteAppChartErrorData} = useDeleteAppChart(store, handleSuccess);

function openDelete(row: AppChart) {
  chartToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedApps.value = !!row.boundApps;
}

function closeDelete() {
showDeleteModal.value = false;
hasAssociatedApps.value = false;
chartToDelete.value = null;
}

async function onSubmitDelete() {
    if (!chartToDelete.value) {
        return;
    }
    const chartName = chartToDelete.value.meta.name;
    deleteAppChart({ name: chartName });
}

function handleSuccess() {
    store.dispatch('growl/success', {
        title:   t('epinio.growl.appCharts.delete.success.title'),
        message: t('epinio.growl.appCharts.delete.success.message', { name: chartToDelete.value?.meta.name }),
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
        <p>You are attempting to delete the Chart <strong>{{ chartToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedApps" color="warning" label="This chart is currently associated with one or more applications. Deleting it will prevent future rebuilds." />
        <Banner
            v-if="deleteAppChartError"
            color="error"
            :label="deleteAppChartErrorData?.message || t('epinio.appCharts.errors.delete')"
        />
        </div>
        <div slot="footer">
        <trailhand-button variant="secondary" class="mr-10" @button-click="closeDelete"
            >Cancel</trailhand-button
        >
        <trailhand-button :disabled="isDeletingAppChart" variant="destructive" @button-click="onSubmitDelete"
            >{{ isDeletingAppChart ? t('generic.deleting') : t('generic.delete') }}</trailhand-button
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