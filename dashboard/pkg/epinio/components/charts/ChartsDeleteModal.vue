<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from 'vuex';
import EpinoAppChartModel from 'models/appcharts';
import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const showDeleteModal = ref<boolean>(false);
const chartToDelete = ref<EpinoAppChartModel | null>(null);
const errors = ref<Array<string>>([]);
const deletingChart = ref<boolean>(false);
const hasAssociatedApps = ref<boolean>(false);

const store = useStore();
const t = store.getters['i18n/t'];

function openDelete(row: EpinoAppChartModel) {
  chartToDelete.value = row;
  showDeleteModal.value = true;
  hasAssociatedApps.value = !!row.bound_apps;
}

function closeDelete() {
showDeleteModal.value = false;
errors.value = [];
hasAssociatedApps.value = false;
chartToDelete.value = null;
}

async function onSubmitDelete() {
if (!chartToDelete.value) {
    return;
}
const chartName = chartToDelete.value.meta.name;
try {
    deletingChart.value = true;
    await chartToDelete.value.remove();
    store.dispatch('growl/success', {
      title:   t('epinio.growl.appCharts.delete.success.title'),
      message: t('epinio.growl.appCharts.delete.success.message', { name: chartName }),
    });
    closeDelete();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.APP_CHARTS, opt: { force: true } });
} catch(e) {
    errors.value = [];
    errors.value = epinioExceptionToErrorsArray(e).map(JSON.stringify);
    store.dispatch('growl/error', {
      title:   t('epinio.growl.appCharts.delete.error.title'),
      message: t('epinio.growl.appCharts.delete.error.message', { name: chartName }),
    });
} finally {
    deletingChart.value = false;
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
        <p>You are attempting to delete the Chart <strong>{{ chartToDelete?.meta.name }}</strong>.</p>
        <p>Are you sure you want to proceed?</p>
        <Banner v-if="hasAssociatedApps" color="warning" label="This chart is currently associated with one or more applications. Deleting it will prevent future rebuilds." />
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
        <trailhand-button @button-click="onSubmitDelete" :disabled="deletingChart" variant="destructive"
            >{{ deletingChart ? 'Deleting...' : t('generic.delete') }}</trailhand-button
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