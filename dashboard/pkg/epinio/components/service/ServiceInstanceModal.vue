<script setup lang="ts">
import { computed, ref, reactive } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');
// Model instance, used only for API calls
const serviceModel = ref<any>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const formNamespace = ref('');
const formName = ref('');
const formCatalogService = ref('');

const initialBoundApps = ref<string[]>([]);
const selectedApps = ref<string[]>([]);
const chartValues = reactive<Record<string, any>>({});
const validChartValues = ref<Record<string, boolean>>({});
const saving = ref(false);
const errors = ref<string[]>([]);

const namespaces = computed(() =>
  sortBy(store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'meta.name', false) as any[]
);

const namespaceOpts = computed(() =>
  namespaces.value.map((ns: any) => ({ label: ns.meta?.name || '', value: ns.meta?.name || '' }))
);

const catalogServices = computed(() =>
  store.getters['epinio/all'](EPINIO_TYPES.CATALOG_SERVICE)
);

const catalogServiceOpts = computed(() =>
  catalogServices.value.map((cs: any) => ({
    label: `${cs.name} (${cs.short_description})`,
    value: cs.name,
  }))
);

const nsAppOptions = computed(() => {
  if (!formNamespace.value) return [];

  return store.getters['epinio/all'](EPINIO_TYPES.APP)
    .filter((a: any) => a.meta.namespace === formNamespace.value)
    .map((a: any) => ({ label: a.meta.name, value: a.meta.name }));
});

const selectedCatalogService = computed(() =>
  catalogServices.value.find((cs: any) => cs.name === formCatalogService.value)
);

const showChartValues = computed(() =>
  Object.keys(selectedCatalogService.value?.settings || {}).length !== 0
);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const isDirty = computed(() => {
  if (isView.value) return false;

  if (isEdit.value) {
    if (!serviceModel.value) return false;

    const settingsChanged = !isEqual(
      objValuesToString(chartValues),
      objValuesToString(serviceModel.value.settings || {})
    );
    const appsChanged = !isEqual(
      [...selectedApps.value].sort(),
      [...initialBoundApps.value].sort()
    );

    return settingsChanged || appsChanged;
  }

  return !!(formName.value || formCatalogService.value || selectedApps.value.length || Object.keys(chartValues).length);
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (isEdit.value) {
    if (!serviceModel.value) return false;

    const newSettings = !isEqual(
      objValuesToString(chartValues),
      objValuesToString(serviceModel.value.settings || {})
    );
    const appBindingChanged = !isEqual(
      [...selectedApps.value].sort(),
      [...initialBoundApps.value].sort()
    );

    return newSettings || appBindingChanged;
  }

  if (!formCatalogService.value) return false;
  if (!formName.value) return false;
  if (!formNamespace.value) return false;
  if (showChartValues.value && !Object.values(validChartValues.value).every((v) => !!v)) return false;

  const nameErrors = validateKubernetesName(formName.value, '', store.getters, undefined, []);
  const nsErrors = validateKubernetesName(formNamespace.value, '', store.getters, undefined, []);

  return nameErrors.length === 0 && nsErrors.length === 0;
});

function openCreate(prefilledCatalogService?: string) {
  errors.value = [];
  modalMode.value = 'create';

  serviceModel.value = null;
  formNamespace.value = namespaces.value[0]?.meta?.name || '';
  formName.value = '';
  formCatalogService.value = prefilledCatalogService || '';

  selectedApps.value = [];
  initialBoundApps.value = [];
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};

  showModal.value = true;
}

function openView(row: any) {
  errors.value = [];
  modalMode.value = 'view';

  serviceModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  formName.value = row.name || row.meta?.name || '';
  formCatalogService.value = row.catalog_service || '';

  selectedApps.value = [...(row.boundapps || [])];
  initialBoundApps.value = [...(row.boundapps || [])];

  const settings = objValuesToString(row.settings || {});

  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  Object.assign(chartValues, settings);
  validChartValues.value = {};

  showModal.value = true;
}

function openEdit(row: any) {
  errors.value = [];
  modalMode.value = 'edit';

  serviceModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  formName.value = row.name || row.meta?.name || '';
  formCatalogService.value = row.catalog_service || '';

  selectedApps.value = [...(row.boundapps || [])];
  initialBoundApps.value = [...(row.boundapps || [])];

  const settings = objValuesToString(row.settings || {});

  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  Object.assign(chartValues, settings);
  validChartValues.value = {};

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
  formName.value = '';
  formCatalogService.value = '';
  formNamespace.value = '';
  selectedApps.value = [];
  initialBoundApps.value = [];
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};
  errors.value = [];
  serviceModel.value = null;
  showDiscardConfirm.value = false;
  showModal.value = false;
}

function resetChartValues() {
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};
}

async function onSubmit() {
  if (!validationPassed.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  try {
    if (!isEdit.value) {
      const svc = await store.dispatch('epinio/create', { type: EPINIO_TYPES.SERVICE_INSTANCE });

      // Capture values before closeModal() wipes form state
      const capturedNamespace = formNamespace.value;
      const capturedName = formName.value;
      const capturedSelectedApps = [...selectedApps.value];

      // Create the service instance, then bind apps and refresh in the background
      svc.metadata = { namespace: capturedNamespace, name: capturedName };
      svc.catalog_service = formCatalogService.value;

      const cleanSettings = { ...chartValues };

      delete cleanSettings.value;
      svc.settings = Object.keys(cleanSettings).length ? objValuesToString(cleanSettings) : undefined;

      await svc.create();

      // Re-assert metadata: followLink merges the sparse create response back
      // into the model, which can wipe metadata and break subsequent bind calls
      svc.metadata = { namespace: capturedNamespace, name: capturedName };

      closeModal();

      // Show the new item quickly, then bind apps and refresh again once done
      svc.forceFetch().catch(() => {});
      if (capturedSelectedApps.length) {
        Promise.all(capturedSelectedApps.map((app: string) => svc.bindApp(app)))
          .then(() => svc.forceFetch())
          .catch(() => {});
      }
    } else {
      const svc = serviceModel.value;
      const newSettings = !isEqual(
        objValuesToString(chartValues),
        objValuesToString(svc.settings || {})
      );

      if (newSettings) {
        const cleanSettings = { ...chartValues };

        delete cleanSettings.value;
        svc.settings = objValuesToString(cleanSettings);
        await svc.update();
      }

      const bindApps = selectedApps.value;
      const unbindApps = initialBoundApps.value.filter(a => !bindApps.includes(a));
      const newBindApps = bindApps.filter(a => !initialBoundApps.value.includes(a));

      closeModal();

      // Bind/unbind and refresh in the background
      Promise.all([
        ...newBindApps.map((a: string) => svc.bindApp(a)),
        ...unbindApps.map((a: string) => svc.unbindApp(a)),
      ]).catch(() => {});
      svc.forceFetch().catch(() => {});
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
  } finally {
    saving.value = false;
  }
}

defineExpose({ openCreate, openEdit, openView });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isEdit || isView) ? formName : 'Instances'"
    :subtitle="(isEdit || isView) ? (serviceModel?.stateDisplay || '') : 'Create New'"
    @modal-close="handleModalClose"
  >
    <div class="modal-content">
      <trailhand-form-card>
        <!-- Namespace + Name -->
        <trailhand-form-row columns="2">
          <trailhand-dropdown
            style="width: 100%"
            :options="namespaceOpts"
            :value="formNamespace"
            label="Namespace"
            :required="!isView"
            :disabled="isEdit || isView"
            placeholder="Select a namespace"
            @dropdown-change="(e: CustomEvent) => { formNamespace = e.detail.value; selectedApps = []; }"
          ></trailhand-dropdown>
          <trailhand-text-input
            :value="formName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { formName = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>

        <!-- Catalog Service -->
        <trailhand-form-row>
          <trailhand-dropdown
            style="width: 100%"
            :options="catalogServiceOpts"
            :value="formCatalogService"
            label="Catalog Service"
            :required="!isView"
            :disabled="isEdit || isView"
            :filterable="true"
            placeholder="Select the type of service to create"
            @dropdown-change="(e: CustomEvent) => { formCatalogService = e.detail.value; resetChartValues(); }"
          ></trailhand-dropdown>
        </trailhand-form-row>

        <!-- Bind to Application -->
        <trailhand-form-row>
          <trailhand-dropdown
            style="width: 100%"
            :options="nsAppOptions"
            :values="selectedApps"
            label="Bind to Application (Optional)"
            :disabled="isView"
            :multiselect="true"
            :filterable="true"
            placeholder="Select applications to bind"
            @dropdown-change="(e: CustomEvent) => { selectedApps = e.detail.values; }"
          ></trailhand-dropdown>
        </trailhand-form-row>

        <!-- Chart Values (shown when the selected catalog service has configurable settings) -->
        <trailhand-form-row
          v-if="showChartValues"
          :title="t('epinio.services.chartValues.title')"
        >
          <ChartValues
            v-model:value="chartValues"
            :chart="selectedCatalogService.settings"
            :title="t('epinio.services.chartValues.title')"
            :mode="isEdit ? 'edit' : 'create'"
            :disabled="isView"
            @valid="validChartValues = $event"
          />
        </trailhand-form-row>
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
          :disabled="!validationPassed || saving"
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
  width: 560px;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
