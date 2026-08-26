<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { validateSettings } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartSettings from '../settings/ChartSettings.vue';
import { ChartSetting } from '../../models/catalogservice/ui-types';
import { useCreateAppChart, useUpdateAppChart } from '../../queries/useAppChartsMutations';
import { AppChart, AppChartUpdateRequest, AppChartCreateRequest } from '../../models/appcharts/ui-types';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<AppChart | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const chartName = ref('');
const chartShortDescription = ref('');
const chartDescription = ref('');
const helmChartUrl = ref('');
const helmRepoUrl = ref('');
const chartSettings = ref<ChartSetting[]>([]);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const {mutateAsync: createAppChart, isPending: isCreatingAppChart, isError: createAppChartError, error: createAppChartErrorData} = useCreateAppChart(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: updateAppChart, isPending: isUpdatingAppChart, isError: updateAppChartError, error: updateAppChartErrorData} = useUpdateAppChart(store, () => {
  handleSuccess('update');
  closeModal();
});

const isDirty = computed(() => {
  return dirtyFields.value.name ||
    dirtyFields.value.shortDescription ||
    dirtyFields.value.description ||
    dirtyFields.value.helmChart ||
    dirtyFields.value.helmRepo ||
    dirtyFields.value.settings;
});

const dirtyFields = computed(() => {
  const fields: Partial<
    Record<keyof AppChartCreateRequest, boolean>
  > = {};

  fields.name = chartName.value !== (initialValues.value?.meta.name || '');
  fields.shortDescription = chartShortDescription.value !== (initialValues.value?.shortDescription || '');
  fields.description = chartDescription.value !== (initialValues.value?.description || '');
  fields.helmChart = helmChartUrl.value !== (initialValues.value?.helmChart || '');
  fields.helmRepo = helmRepoUrl.value !== (initialValues.value?.helmRepo || '');
  fields.settings = !isEqual(sortBy(chartSettings.value, 'name'), sortBy(initialValues.value?.settings || [], 'name'));

  return fields;
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!chartName.value) return false;
  if (!chartShortDescription.value) return false;
  if (!chartDescription.value) return false;
  if (!helmRepoUrl.value && !helmChartUrl.value) return false;

  const settingsValid = validateSettings(chartSettings.value);
  if (!settingsValid) return false;

  const nameErrors = validateKubernetesName(chartName.value, '', store.getters, undefined, []);
  return nameErrors.length === 0;
});

const canSave = computed(() => {
  const dirty = isDirty.value;
  const valid = validationPassed.value;
  return dirty && valid && !isCreatingAppChart.value && !isUpdatingAppChart.value;
});

function openCreate() {
  modalMode.value = 'create';
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  chartSettings.value = [];
  showModal.value = true;
}

function openEdit(row: AppChart) {
  modalMode.value = 'edit';
  initialValues.value = row;
  chartName.value = row.meta?.name || '';
  chartShortDescription.value = row.shortDescription || '';
  chartDescription.value = row.description || '';
  helmChartUrl.value = row.helmChart || '';
  helmRepoUrl.value = row.helmRepo || '';
  chartSettings.value = row.settings || [];
  showModal.value = true;
}

function handleModalClose() {
  if (isDirty.value) {
    showDiscardConfirm.value = true;
  } else {
    closeModal();
  }
}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

function closeModal() {
  // Clear form state before setting showModal = false so that when Lit fires
  // modal-close (which triggers handleModalClose), isDirty is already false
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  chartSettings.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  initialValues.value = null;
}

const buildCreateRequest = (): AppChartCreateRequest => {
  const request: AppChartCreateRequest = {
    name: chartName.value,
    shortDescription: chartShortDescription.value,
    description: chartDescription.value,
  };
  if (helmChartUrl.value) {
    request.helmChart = helmChartUrl.value;
  }
  if (helmRepoUrl.value) {
    request.helmRepo = helmRepoUrl.value;
  }
  if (chartSettings.value.length > 0) {
    request.settings = chartSettings.value;
  }
  return request;
};

const buildUpdateRequest = (): AppChartUpdateRequest => {
  const request: AppChartUpdateRequest = {};

  if (dirtyFields.value.name) {
    request.name = chartName.value;
  }

  if (dirtyFields.value.description) {
    request.description = chartDescription.value;
  }

  if (dirtyFields.value.shortDescription) {
    request.shortDescription = chartShortDescription.value;
  }

  if (dirtyFields.value.helmChart) {
    request.helmChart = helmChartUrl.value;
  }

  if (dirtyFields.value.helmRepo) {
    request.helmRepo = helmRepoUrl.value;
  }

  if (dirtyFields.value.settings) {
    request.settings = chartSettings.value;
  }

  return request;
};

async function onSubmit() {
    if (!validationPassed.value || !isDirty.value || isCreatingAppChart.value || isUpdatingAppChart.value) return;

    if (isEdit.value && initialValues.value) {
      const request = buildUpdateRequest();
      await updateAppChart({ name: initialValues.value.meta.name, request });
    } else {
      const request = buildCreateRequest();
      await createAppChart({ request });
    }
}

const handleSuccess = (type: 'create' | 'update') => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.appCharts.${type}.success.title`),
    message: t(`epinio.growl.appCharts.${type}.success.message`, { name: chartName.value }),
  });
};

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? chartName|| 'App Chart' : 'App Chart'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <trailhand-form-card>
        <Banner v-if="initialValues?.boundApps" color="warning" label="This chart is currently associated with one or more applications. Editing it may cause issues for future rebuilds." />
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="chartName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isView || isEdit"
            @text-input-change="(e: CustomEvent) => { chartName = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="chartShortDescription"
            label="Short Description"
            placeholder="A brief description"
            :required="true"
            :disabled="isView"
            @text-input-change="(e: CustomEvent) => { chartShortDescription = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row>
          <trailhand-text-area
            :value="chartDescription"
            label="Description"
            placeholder="A detailed description"
            :disabled="isView"
            required
            @text-area-change="(e: CustomEvent) => { chartDescription = e.detail.value; }"
          ></trailhand-text-area>
        </trailhand-form-row>
        <div>
          <label style="font-size: 11px; color: var(--th-input-label);">Helm URLs - Provide at least one of the following: <span style="color: var(--th-color-red);">*</span></label>
          <trailhand-form-row columns="2">
            <trailhand-text-input
              :value="helmChartUrl"
              label="Helm Chart URL"
              placeholder="e.g. https://example.com/charts/mychart-0.1.0.tgz"
              :disabled="isView"
              @text-input-change="(e: CustomEvent) => { helmChartUrl = e.detail.value; }"
            ></trailhand-text-input>
            <trailhand-text-input
              :value="helmRepoUrl"
              label="Helm Repo URL"
              placeholder="e.g. https://example.com/charts/index.yaml"
              :disabled="isView"
              @text-input-change="(e: CustomEvent) => { helmRepoUrl = e.detail.value; }"
            ></trailhand-text-input>
          </trailhand-form-row>
        </div>
        <ChartSettings
          v-model="chartSettings"
          :disabled="isView"
          allow-defaults
        />
      </trailhand-form-card>
      <Banner
        v-if="createAppChartError || updateAppChartError"
        color="error"
        :label="createAppChartErrorData?.message || updateAppChartErrorData?.message || t('epinio.appCharts.errors.save')"
      />
    </div>

    <div slot="footer">
      <template v-if="isView">
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="closeModal"
        >
          Close
        </trailhand-button>
        <trailhand-button
          variant="primary"
          @button-click="modalMode = 'edit'"
        >
          Edit Configuration
        </trailhand-button>
      </template>
      <template v-else-if="showDiscardConfirm">
        <span class="discard-message">You have unsaved changes.</span>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleKeepEditing"
        >
          Keep Editing
        </trailhand-button>
        <trailhand-button
          variant="destructive"
          @button-click="handleDiscard"
        >
          Discard
        </trailhand-button>
      </template>
      <template v-else>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          Cancel
        </trailhand-button>
        <trailhand-button
          variant="primary"
          :disabled="!canSave"
          @button-click="onSubmit"
        >
          {{ isEdit ? (isUpdatingAppChart ? t('generic.updating') : t('generic.save')) : (isCreatingAppChart ? t('generic.creating') : t('generic.create')) }}
        </trailhand-button>
      </template>
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 1000px;
  min-height: 500px;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
