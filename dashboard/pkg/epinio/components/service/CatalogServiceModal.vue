<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString, mapSettingsFromApiResponse, mapSettingsToApiRequest, validateSettings } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import EpinioCatalogServiceModel from '../../models/catalogservices';
import ChartSettings, { ConfigSetting } from '../settings/ChartSettings.vue';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<EpinioCatalogServiceModel | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const catalogServiceName = ref('');
const catalogServiceShortDescription = ref('');
const catalogServiceDescription = ref('');
const catalogServiceChart = ref('');
const catalogServiceChartVersion = ref('');
const catalogServiceAppVersion = ref('');
const catalogServiceIcon = ref('');
const catalogServiceHelmRepo = ref({ name: '', url: '', secret: '' });
const chartSettings = ref<ConfigSetting[]>([]);
const catalogServiceSecretTypes = ref<string[]>([]);

const saving = ref(false);
const errors = ref<string[]>([]);
const hasAssociatedServices = ref<boolean>(false);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const showAdvancedOptions = ref<boolean>(false);

const isDirty = computed(() => {
  if (!initialValues.value) {
    return catalogServiceName.value !== '' ||
      catalogServiceShortDescription.value !== '' ||
      catalogServiceDescription.value !== '' ||
      catalogServiceChart.value !== '' ||
      catalogServiceChartVersion.value !== '' ||
      catalogServiceAppVersion.value !== '' ||
      catalogServiceIcon.value !== '' ||
      catalogServiceHelmRepo.value.name !== '' ||
      catalogServiceHelmRepo.value.url !== '' ||
      catalogServiceHelmRepo.value.secret !== '' ||
      chartSettings.value.length > 0 ||
      catalogServiceSecretTypes.value.length > 0;
  }

  const initialSettings = mapSettingsFromApiResponse(initialValues.value);

  const isDirty = catalogServiceName.value !== (initialValues.value!.meta.name || '') ||
    catalogServiceShortDescription.value !== (initialValues.value!.short_description || '') ||
    catalogServiceDescription.value !== (initialValues.value!.description || '') ||
    catalogServiceChart.value !== (initialValues.value!.chart || '') ||
    catalogServiceChartVersion.value !== (initialValues.value!.chart_version || '') ||
    catalogServiceAppVersion.value !== (initialValues.value!.app_version || '') ||
    catalogServiceIcon.value !== (initialValues.value!.service_icon || '') ||
    catalogServiceHelmRepo.value.name !== (initialValues.value!.helm_repo?.name || '') ||
    catalogServiceHelmRepo.value.url !== (initialValues.value!.helm_repo?.url || '') ||
    catalogServiceHelmRepo.value.secret !== (initialValues.value!.helm_repo?.secret || '') ||
    !isEqual(sortBy(chartSettings.value, 'name'), sortBy(initialSettings, 'name')) ||
    !isEqual(sortBy(catalogServiceSecretTypes.value), sortBy(initialValues.value!.secret_types || []));
 
  return isDirty;
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
  return dirty && valid && !saving.value;
});

function openCreate() {
  errors.value = [];
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

function openEdit(row: EpinioCatalogServiceModel) {
  errors.value = [];
  modalMode.value = 'edit';
  initialValues.value = row;
  catalogServiceName.value = row.name || row.meta?.name || '';
  catalogServiceShortDescription.value = row.short_description || '';
  catalogServiceDescription.value = row.description || '';
  catalogServiceChart.value = row.chart || '';
  catalogServiceChartVersion.value = row.chart_version || '';
  catalogServiceAppVersion.value = row.app_version || '';
  catalogServiceIcon.value = row.service_icon || '';
  catalogServiceHelmRepo.value = {
    name: row.helm_repo?.name || '',
    url: row.helm_repo?.url || '',
    secret: row.helm_repo?.secret || ''
  };
  chartSettings.value = mapSettingsFromApiResponse(row);
  catalogServiceSecretTypes.value = row.secret_types || [];
  hasAssociatedServices.value = !!row.bound_services && row.bound_services.length > 0;
  showAdvancedOptions.value = row.secret_types && row.secret_types.length > 0;

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
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  initialValues.value = null;
  hasAssociatedServices.value = false;
  showAdvancedOptions.value = false;
}

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  const { settings } = mapSettingsToApiRequest(chartSettings.value);

  try {
    if (isEdit.value && initialValues.value) {
      const catalogService = initialValues.value;

      catalogService.description       = catalogServiceDescription.value;
      catalogService.short_description = catalogServiceShortDescription.value;
      catalogService.chart             = catalogServiceChart.value;
      catalogService.chart_version     = catalogServiceChartVersion.value;
      catalogService.app_version       = catalogServiceAppVersion.value;
      catalogService.service_icon      = catalogServiceIcon.value;
      catalogService.helm_repo         = { ...catalogServiceHelmRepo.value };
      catalogService.settings          = settings;
      catalogService.secret_types      = [...catalogServiceSecretTypes.value];

      await catalogService.update();
      store.dispatch('growl/success', {
        title:   t('epinio.growl.catalogServices.update.success.title'),
        message: t('epinio.growl.catalogServices.update.success.message', { name: catalogServiceName.value }),
      });
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE, opt: { force: true } }).catch(() => {});
    } else {
      const catalogService = await store.dispatch('epinio/create', { type: EPINIO_TYPES.CATALOG_SERVICE });

      catalogService.metadata          = { name: catalogServiceName.value };
      catalogService.description       = catalogServiceDescription.value;
      catalogService.short_description = catalogServiceShortDescription.value;
      catalogService.chart             = catalogServiceChart.value;
      catalogService.chart_version     = catalogServiceChartVersion.value;
      catalogService.app_version       = catalogServiceAppVersion.value;
      catalogService.service_icon      = catalogServiceIcon.value;
      catalogService.helm_repo         = { ...catalogServiceHelmRepo.value };
      catalogService.settings          = settings;
      catalogService.secret_types      = [...catalogServiceSecretTypes.value];

      await catalogService.create();
      store.dispatch('growl/success', {
        title:   t('epinio.growl.catalogServices.create.success.title'),
        message: t('epinio.growl.catalogServices.create.success.message', { name: catalogServiceName.value }),
      });
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.CATALOG_SERVICE, opt: { force: true } }).catch(() => {});
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
    store.dispatch('growl/error', {
      title: isEdit.value
        ? t('epinio.growl.catalogServices.save.error.updateTitle')
        : t('epinio.growl.catalogServices.save.error.createTitle'),
      message: t('epinio.growl.catalogServices.save.error.message'),
    });
    console.error('Error saving catalog service:', err);
  } finally {
    saving.value = false;
  }
}

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? initialValues?.meta?.name || 'Catalog Service' : 'Catalog Service'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    @modal-close="handleModalClose"
    position="top"
  >
    <div class="modal-content" id="modal-container-element">
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
          <trailhand-form-row columns="1" v-for="(value, index) in catalogServiceSecretTypes" :key="index">
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
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
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
          {{ saving ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? t('generic.save') : t('generic.create')) }}
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
