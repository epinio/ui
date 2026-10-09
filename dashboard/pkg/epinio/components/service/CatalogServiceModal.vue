<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { useCreateCatalogService, useUpdateCatalogService } from '../../queries/useCatalogServiceMutation';

import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { validateSettings } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartSettings from '../settings/ChartSettings.vue';
import { CatalogService, ChartSetting, CatalogServiceCreateRequest, CatalogServiceUpdateRequest } from '../../models/catalogservice/ui-types';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<CatalogService | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const catalogServiceName = ref('');
const catalogServiceShortDescription = ref('');
const catalogServiceDescription = ref('');
const catalogServiceChart = ref('');
const catalogServiceChartVersion = ref('');
const catalogServiceAppVersion = ref('');
const catalogServiceIcon = ref('');
const catalogServiceHelmRepo = ref({ name: '', url: '', secret: '' });
const chartSettings = ref<ChartSetting[]>([]);
const catalogServiceSecretTypes = ref<string[]>([]);

const hasAssociatedServices = ref<boolean>(false);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const showAdvancedOptions = ref<boolean>(false);

const {mutateAsync: createCatalogService, isPending: isCreatingCatalogService, isError: createCatalogServiceError, error: createCatalogServiceErrorData} = useCreateCatalogService(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: updateCatalogService, isPending: isUpdatingCatalogService, isError: updateCatalogServiceError, error: updateCatalogServiceErrorData} = useUpdateCatalogService(store, () => {
  handleSuccess('update');
  closeModal();
});

const isDirty = computed(() => {
  return dirtyFields.value.name ||
    dirtyFields.value.shortDescription ||
    dirtyFields.value.description ||
    dirtyFields.value.chart ||
    dirtyFields.value.chartVersion ||
    dirtyFields.value.appVersion ||
    dirtyFields.value.serviceIcon ||
    dirtyFields.value.helmRepo ||
    dirtyFields.value.settings ||
    dirtyFields.value.secretTypes;
 });

const dirtyFields = computed(() => {
  const fields: Partial<
    Record<keyof CatalogServiceCreateRequest, boolean>
  > = {};

  fields.name = catalogServiceName.value !== (initialValues.value?.meta.name || '');
  fields.shortDescription = catalogServiceShortDescription.value !== (initialValues.value?.shortDescription || '');
  fields.description = catalogServiceDescription.value !== (initialValues.value?.description || '');
  fields.chart = catalogServiceChart.value !== (initialValues.value?.chart || '');
  fields.chartVersion = catalogServiceChartVersion.value !== (initialValues.value?.chartVersion || '');
  fields.appVersion = catalogServiceAppVersion.value !== (initialValues.value?.appVersion || '');
  fields.serviceIcon = catalogServiceIcon.value !== (initialValues.value?.serviceIcon || '');
  fields.helmRepo = catalogServiceHelmRepo.value.name !== (initialValues.value?.helmRepo?.name || '') ||
                    catalogServiceHelmRepo.value.url !== (initialValues.value?.helmRepo?.url || '') ||
                    catalogServiceHelmRepo.value.secret !== (initialValues.value?.helmRepo?.secret || '');
  fields.settings = !isEqual(sortBy(chartSettings.value, 'name'), sortBy(initialValues.value?.settings || [], 'name'));
  fields.secretTypes = !isEqual(sortBy(catalogServiceSecretTypes.value), sortBy(initialValues.value?.secretTypes || []));

  return fields;
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!catalogServiceName.value) return false;
  if (!catalogServiceShortDescription.value) return false;
  if (!catalogServiceDescription.value) return false;
  if (!catalogServiceChart.value) return false;
  if (!catalogServiceHelmRepo.value.name) return false;
  if (!catalogServiceHelmRepo.value.url) return false;

  const settingsValidation = validateSettings(chartSettings.value);
  if (!settingsValidation) return false;

  const secretTypesValid = catalogServiceSecretTypes.value.every((type) => type && type.trim() !== '');
  if (!secretTypesValid) return false;

  const nameErrors = validateKubernetesName(catalogServiceName.value, '', store.getters, undefined, []);
  return nameErrors.length === 0;
});

const canSave = computed(() => {
  const dirty = isDirty.value;
  const valid = validationPassed.value;
  return dirty && valid && !isCreatingCatalogService.value && !isUpdatingCatalogService.value;
});

function openCreate() {
  modalMode.value = 'create';
  catalogServiceName.value = '';
  catalogServiceShortDescription.value = '';
  catalogServiceDescription.value = '';
  catalogServiceChart.value = '';
  catalogServiceChartVersion.value = '';
  catalogServiceAppVersion.value = '';
  catalogServiceIcon.value = '';
  catalogServiceHelmRepo.value = { name: '', url: '', secret: '' };
  chartSettings.value = [];
  catalogServiceSecretTypes.value = [];
  showModal.value = true;
}

function openEdit(row: CatalogService) {
  modalMode.value = 'edit';
  initialValues.value = row;
  catalogServiceName.value = row.meta.name;
  catalogServiceShortDescription.value = row.shortDescription || '';
  catalogServiceDescription.value = row.description || '';
  catalogServiceChart.value = row.chart || '';
  catalogServiceChartVersion.value = row.chartVersion || '';
  catalogServiceAppVersion.value = row.appVersion || '';
  catalogServiceIcon.value = row.serviceIcon || '';
  catalogServiceHelmRepo.value = {
    name: row.helmRepo?.name || '',
    url: row.helmRepo?.url || '',
    secret: row.helmRepo?.secret || ''
  };
  chartSettings.value = row.settings || [];
  catalogServiceSecretTypes.value = row.secretTypes || [];
  hasAssociatedServices.value = !!row.boundServices;
  showAdvancedOptions.value = !!row.secretTypes && row.secretTypes.length > 0;

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
  catalogServiceName.value = '';
  catalogServiceShortDescription.value = '';
  catalogServiceDescription.value = '';
  catalogServiceChart.value = '';
  catalogServiceChartVersion.value = '';
  catalogServiceAppVersion.value = '';
  catalogServiceIcon.value = '';
  catalogServiceHelmRepo.value = { name: '', url: '', secret: '' };
  chartSettings.value = [];
  catalogServiceSecretTypes.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  initialValues.value = null;
  hasAssociatedServices.value = false;
  showAdvancedOptions.value = false;
}

const buildCreateRequest = (): CatalogServiceCreateRequest => {
  const request: CatalogServiceCreateRequest = {
    name: catalogServiceName.value,
    shortDescription: catalogServiceShortDescription.value,
    description: catalogServiceDescription.value,
    chart: catalogServiceChart.value,
    serviceIcon: catalogServiceIcon.value,
    helmRepo: { ...catalogServiceHelmRepo.value },
  };
  if (catalogServiceChartVersion.value) {
    request.chartVersion = catalogServiceChartVersion.value;
  }
  if (catalogServiceAppVersion.value) {
    request.appVersion = catalogServiceAppVersion.value;
  }
  if (catalogServiceIcon.value) {
    request.serviceIcon = catalogServiceIcon.value;
  }
  if (chartSettings.value.length > 0) {
    request.settings = chartSettings.value;
  }
  if (catalogServiceSecretTypes.value.length > 0) {
    request.secretTypes = [...catalogServiceSecretTypes.value];
  }
  return request;
};

const buildUpdateRequest = (): CatalogServiceUpdateRequest => {
  const request: CatalogServiceUpdateRequest = {};

  if (dirtyFields.value.name) {
    request.name = catalogServiceName.value;
  }

  if (dirtyFields.value.description) {
    request.description = catalogServiceDescription.value;
  }

  if (dirtyFields.value.shortDescription) {
    request.shortDescription = catalogServiceShortDescription.value;
  }

  if (dirtyFields.value.chart) {
    request.chart = catalogServiceChart.value;
  }

  if (dirtyFields.value.chartVersion) {
    request.chartVersion = catalogServiceChartVersion.value;
  }

  if (dirtyFields.value.appVersion) {
    request.appVersion = catalogServiceAppVersion.value;
  }

  if (dirtyFields.value.serviceIcon) {
    request.serviceIcon = catalogServiceIcon.value;
  }

  if (dirtyFields.value.helmRepo) {
    request.helmRepo = { ...catalogServiceHelmRepo.value };
  }

  if (dirtyFields.value.settings) {
    request.settings = chartSettings.value;
  }

  if (dirtyFields.value.secretTypes) {
    request.secretTypes = [...catalogServiceSecretTypes.value];
  }

  return request;
};

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || isCreatingCatalogService.value || isUpdatingCatalogService.value) return;

  if (isEdit.value && initialValues.value) {
    const request: CatalogServiceUpdateRequest = buildUpdateRequest();

    await updateCatalogService({ name: initialValues.value.meta.name, request });
  } else {
    const request: CatalogServiceCreateRequest = buildCreateRequest();
    await createCatalogService({request});
  }
}

const handleSuccess = (type: 'create' | 'update') => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.catalogServices.${type}.success.title`),
    message: t(`epinio.growl.catalogServices.${type}.success.message`, { name: catalogServiceName.value }),
  });
};

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? initialValues?.meta?.name || 'Catalog Service' : 'Catalog Service'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <trailhand-form-card>
        <Banner v-if="hasAssociatedServices" color="warning" label="This catalog service is currently associated with one or more services. Editing it may cause issues for those services." />
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="catalogServiceName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isEdit"
            @text-input-change="(e: CustomEvent) => { catalogServiceName = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="catalogServiceShortDescription"
            label="Short Description"
            placeholder="A brief description"
            :required="true"
            @text-input-change="(e: CustomEvent) => { catalogServiceShortDescription = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row>
          <trailhand-text-area
            :value="catalogServiceDescription"
            label="Description"
            placeholder="A detailed description"
            required
            @text-area-change="(e: CustomEvent) => { catalogServiceDescription = e.detail.value; }"
          ></trailhand-text-area>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-text-input
            :value="catalogServiceIcon"
            label="Icon URL"
            placeholder="e.g. registry.example.com/builder:latest"
            @text-input-change="(e: CustomEvent) => { catalogServiceIcon = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-text-input
            :value="catalogServiceChart"
            label="Chart"
            placeholder="e.g. mychart"
            required
            @text-input-change="(e: CustomEvent) => { catalogServiceChart = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="catalogServiceChartVersion"
            label="Chart Version"
            placeholder="1.0.0"
            @text-input-change="(e: CustomEvent) => { catalogServiceChartVersion = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="catalogServiceAppVersion"
            label="App Version"
            placeholder="1.0.0"
            @text-input-change="(e: CustomEvent) => { catalogServiceAppVersion = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-text-input
            :value="catalogServiceHelmRepo.name"
            label="Helm Repo Name"
            placeholder="e.g. my-helm-repo"
            required
            @text-input-change="(e: CustomEvent) => { catalogServiceHelmRepo.name = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="catalogServiceHelmRepo.url"
            label="Helm Repo URL"
            placeholder="e.g. https://my-helm-repo.com"
            :required="true"
            @text-input-change="(e: CustomEvent) => { catalogServiceHelmRepo.url = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="catalogServiceHelmRepo.secret"
            label="Helm Repo Secret"
            placeholder="e.g. my-helm-repo-secret"
            @text-input-change="(e: CustomEvent) => { catalogServiceHelmRepo.secret = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <ChartSettings
          v-model="chartSettings"
        />
        <trailhand-form-row columns="1">
          <trailhand-checkbox
            :checked="showAdvancedOptions"
            label="Show Advanced Options"
            @checkbox-change="(e: CustomEvent) => { showAdvancedOptions = e.detail.checked; }"
          >Show Advanced Options</trailhand-checkbox>
        </trailhand-form-row>
        <template v-if="showAdvancedOptions">
          <h3>Secret Types</h3>
          <trailhand-form-row v-for="(value, index) in catalogServiceSecretTypes" :key="index" columns="1">
            <div style="display: flex; align-items: flex-end; gap: 8px;">
              <trailhand-text-input
                :value="value"
                placeholder="e.g. database-credentials"
                style="flex: 1;"
                @text-input-change="(e: CustomEvent) => {
                  const newValue = e.detail.value;
                  catalogServiceSecretTypes[index] = newValue;
                }"
              ></trailhand-text-input>
              <trailhand-button
                variant="destructive"
                @button-click="catalogServiceSecretTypes = catalogServiceSecretTypes.filter((_, i) => i !== index)"
              >
                Remove
              </trailhand-button>
            </div>
          </trailhand-form-row>
          <div>
            <trailhand-button
              variant="alternate"
              @button-click="catalogServiceSecretTypes.push('')"
            >
              Add Secret Type
            </trailhand-button>
          </div>
        </template>
      </trailhand-form-card>

      <Banner
        v-if="createCatalogServiceError || updateCatalogServiceError"
        color="error"
        :label="createCatalogServiceErrorData?.message || updateCatalogServiceErrorData?.message || t('epinio.catalogservices.errors.save')"
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
          {{ isEdit ? (isUpdatingCatalogService ? t('generic.updating') : t('generic.save')) : (isCreatingCatalogService ? t('generic.creating') : t('generic.create')) }}
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
  min-height: 350px;
}

.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
