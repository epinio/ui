<script setup lang="ts">
import { ref, computed, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import Banner from '@components/Banner/Banner.vue';
import isEqual from 'lodash/isEqual';
import { useNamespaces } from '../../queries/useNamespaceQueries';
import { useCreateConfiguration, useBindConfiguration, useUpdateConfiguration, useUnbindConfiguration } from '../../queries/useConfigurationMutations';
import { ConfigurationResponse } from '../../models/configuration/ui-types';
import { debounce } from 'lodash';
import ResourceDropdown from '../application/ResourceDropdown.vue';
import { ListResourceRequestParams } from '../../models/resource/ui-types';

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const modalMode = ref<'view' | 'edit' | 'create'>('view');
const configModel = ref<any>(null);

const formNamespace = ref('');
const formName = ref('');
const initialBoundApps = ref<string[]>([]);
const selectedApps = ref<string[]>([]);
const configData = ref<Array<{ key: string; value: string }>>([]);
const initialConfigDataSnapshot = ref('');
const showDiscardConfirm = ref(false);

// Hidden file inputs, both rendered outside the modal to avoid focus-return side effects
const bulkFileInput = ref<HTMLInputElement | null>(null);
const rowFileInput = ref<HTMLInputElement | null>(null);
const currentUploadRow = ref<number | null>(null);
const fileDialogActive = ref(false);

const isView = computed(() => modalMode.value === 'view');
const isEdit = computed(() => modalMode.value === 'edit');
const isCreate = computed(() => modalMode.value === 'create');
const isEditing = computed(() => isEdit.value || isCreate.value);

const isLoadingApplications = ref(false);
const cachedApplications = ref<any[]>([]);
const fetchedApplications = ref<any[]>([]);

const namespaceRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const namespaceRequestOptions = ref({ enabled: false, polling: false });
const {data: namespaces, isLoading: isLoadingNamespaces, isError: isErrorNamespaces, error: namespacesError} = useNamespaces(store, namespaceRequestParams, namespaceRequestOptions);

const {mutateAsync: createConfiguration, isPending: isCreatingConfiguration, isError: createConfigurationError, error: createConfigurationErrorData} = useCreateConfiguration(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: bindConfiguration, isPending: isBindingConfiguration, isError: bindConfigurationError, error: bindConfigurationErrorData} = useBindConfiguration(store);
const {mutateAsync: unbindConfiguration, isPending: isUnbindingConfiguration, isError: unbindConfigurationError, error: unbindConfigurationErrorData} = useUnbindConfiguration(store);
const {mutateAsync: updateConfiguration, isPending: isUpdatingConfiguration, isError: updateConfigurationError, error: updateConfigurationErrorData} = useUpdateConfiguration(store, () => {
  handleSuccess('update');
  closeModal();
});

// Watch for changes to the active namespace cache and update the request params accordingly
watchEffect(() => {
  void store.state.activeNamespaceCacheKey;
  const activeNamespaces = store.state.activeNamespaceCache;

  if (activeNamespaces && Object.keys(activeNamespaces).length > 0) {
    namespaceRequestParams.value.namespaces = Object.keys(activeNamespaces);
  } else {
    namespaceRequestParams.value.namespaces = undefined;
  }
});

const namespaceOpts = computed(() => {
  return namespaces?.value?.items.map((ns: any) => ({ label: ns.meta.name, value: ns.meta.name })) || [];
});

const nsAppOptions = computed(() => {
  if (!formNamespace.value) return [];

  return fetchedApplications.value
    .map((a: any) => ({ label: a.meta.name, value: a.meta.name }));
});

const isDirty = computed(() => {
  if (isCreate.value) {
    return !!(formName.value || selectedApps.value.length || configData.value.some(r => r.key || r.value));
  }
  if (!isEdit.value || !configModel.value) return false;

  const appsChanged = !isEqual([...selectedApps.value].sort(), [...initialBoundApps.value].sort());
  const dataChanged = JSON.stringify(configData.value) !== initialConfigDataSnapshot.value;

  return appsChanged || dataChanged;
});

const configDataValid = computed(() =>
  configData.value.every(row => row.key.trim() !== '' && row.value.trim() !== '')
);

const validationPassed = computed(() => {
  if (!configDataValid.value) return false;

  if (isCreate.value) {
    if (!formNamespace.value || !formName.value) return false;

    const nameErrors = validateKubernetesName(formName.value, '', store.getters, undefined, []);
    const nsErrors = validateKubernetesName(formNamespace.value, '', store.getters, undefined, []);

    return nameErrors.length === 0 && nsErrors.length === 0;
  }

  return isEdit.value && isDirty.value;
});

const modalTitle = computed(() => isCreate.value ? 'Advanced Configurations' : (formName.value || 'Advanced Configurations'));

const modalSubtitle = computed(() => {
  if (isCreate.value) return 'Create New';

  return formNamespace.value;
});

function detailsToRows(details: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(details || {}).map(([key, value]) => ({ key, value }));
}

function rowsToDetails(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const obj: Record<string, string> = {};

  rows.forEach(({ key, value }) => {
    if (key) obj[key] = value;
  });

  return obj;
}

async function openCreate() {
  modalMode.value = 'create';
  configModel.value = null;
  formNamespace.value = '';
  formName.value = '';
  selectedApps.value = [];
  initialBoundApps.value = [];
  configData.value = [{ key: '', value: '' }];
  initialConfigDataSnapshot.value = '';

  namespaceRequestOptions.value.enabled = true;

  showModal.value = true;
}

const populateForm = (row: ConfigurationResponse) => {
  configModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  formName.value = row.meta?.name || '';
  selectedApps.value = [...(row.configuration?.boundApps || [])];
  initialBoundApps.value = [...(row.configuration?.boundApps || [])];
  configData.value = detailsToRows(row.configuration?.details || {});
  initialConfigDataSnapshot.value = JSON.stringify(configData.value);
};

function openView(row: ConfigurationResponse) {
  modalMode.value = 'view';
  populateForm(row);
  namespaceRequestOptions.value.enabled = true;

  showModal.value = true;
}

function openEdit(row: ConfigurationResponse) {
  modalMode.value = 'edit';
  populateForm(row);
  namespaceRequestOptions.value.enabled = true;
  showModal.value = true;
}

function handleModalClose() {
  if (fileDialogActive.value) return;
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
  namespaceRequestOptions.value.enabled = false;
  formNamespace.value = '';
  formName.value = '';
  selectedApps.value = [];
  initialBoundApps.value = [];
  configData.value = [];
  initialConfigDataSnapshot.value = '';
  configModel.value = null;
  showDiscardConfirm.value = false;
  showModal.value = false;
}

function addRow() {
  configData.value = [...configData.value, { key: '', value: '' }];
}

function removeRow(i: number) {
  configData.value = configData.value.filter((_, idx) => idx !== i);
}

function updateRowKey(i: number, key: string) {
  configData.value = configData.value.map((row, idx) => idx === i ? { ...row, key } : row);
}

function updateRowValue(i: number, value: string) {
  configData.value = configData.value.map((row, idx) => idx === i ? { ...row, value } : row);
}

// Upload a file and set its contents as the value for row i.
// Uses a single shared input rendered outside the modal so that when the OS
// file dialog closes, focus does not return inside the modal shadow DOM and
// accidentally trigger modal-close.
function triggerValueFileUpload(i: number) {
  if (!rowFileInput.value) return;
  currentUploadRow.value = i;
  fileDialogActive.value = true;
  rowFileInput.value.click();
}

function onRowFileChange(event: Event) {
  fileDialogActive.value = false;
  const file = (event.target as HTMLInputElement).files?.[0];

  if (file && currentUploadRow.value !== null) {
    const row = currentUploadRow.value;
    const reader = new FileReader();

    reader.onload = (e) => {
      updateRowValue(row, (e.target?.result as string) || '');
    };
    reader.readAsText(file);
  }
  (event.target as HTMLInputElement).value = '';
  currentUploadRow.value = null;
}

// "Add from file", parse a KEY=VALUE file and add rows
function triggerBulkFileUpload() {
  fileDialogActive.value = true;
  bulkFileInput.value?.click();
}

// Parse a simple KEY=VALUE file, ignoring empty lines and comments (lines starting with #)
function onBulkFileChange(event: Event) {
  fileDialogActive.value = false;
  const file = (event.target as HTMLInputElement).files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    const text = (e.target?.result as string) || '';
    const newRows: Array<{ key: string; value: string }> = [];

    text.split('\n').forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) return;

      const sep = trimmed.indexOf('=');

      if (sep > 0) {
        newRows.push({ key: trimmed.slice(0, sep).trim(), value: trimmed.slice(sep + 1) });
      }
    });

    // If there are new rows, add them to the existing config data. If the existing data is just one empty row, replace it instead.
    if (newRows.length) {
      const existing = configData.value;
      const onlyEmptyRow = existing.length === 1 && !existing[0].key && !existing[0].value;

      configData.value = onlyEmptyRow ? newRows : [...existing, ...newRows];
    }
  };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = '';
}

async function onSubmit() {
  if (!validationPassed.value || isCreatingConfiguration.value) return;

  if (isCreate.value) {
    const capturedNamespace = formNamespace.value;
    const capturedName = formName.value;
    const capturedSelectedApps = [...selectedApps.value];

    const request = {
      name: capturedName,
      data: rowsToDetails(configData.value),
    };

    await createConfiguration({ namespace: capturedNamespace, request });

    if (capturedSelectedApps.length) {
      Promise.all(capturedSelectedApps.map(appName => bindConfiguration({ namespace: capturedNamespace, appName, request: { names: [capturedName] } })))
    }
  } else {
    const cfg = configModel.value;
    const capturedNamespace = formNamespace.value;
    const capturedName = cfg.meta?.name;
    const capturedSelectedApps = [...selectedApps.value];
    const capturedInitialApps = [...initialBoundApps.value];
    const dataChanged = JSON.stringify(configData.value) !== initialConfigDataSnapshot.value;

    if (dataChanged) {
      cfg.data = rowsToDetails(configData.value);
      const request = {
        data: cfg.data,
      };
      await updateConfiguration({ namespace: capturedNamespace, configurationName: capturedName, request });
    }

    // Determine which apps were newly bound or unbound, and update accordingly
    const newBindApps = capturedSelectedApps.filter(a => !capturedInitialApps.includes(a));
    const unbindApps = capturedInitialApps.filter(a => !capturedSelectedApps.includes(a));

    if (showModal.value) {
      closeModal();
    }

    if (newBindApps.length || unbindApps.length) {
      Promise.all([
        ...newBindApps.map(appName => bindConfiguration({ namespace: capturedNamespace, appName, request: { names: [capturedName] } })),
        ...unbindApps.map(appName => unbindConfiguration({ namespace: capturedNamespace, appName, configName: capturedName }))
      ]).then(() => {
      store.dispatch('growl/success', {
        title:   t(`epinio.growl.configuration.bindings.success.title`),
        message: t(`epinio.growl.configuration.bindings.success.message`, { name: capturedName }),
      });
    });
    }
  }
}

const onNamespaceFilter = debounce((query: string) => {
  namespaceRequestParams.value.page = 1;
  namespaceRequestParams.value.search = query;
}, 500);

watchEffect(() => {
  if (bindConfigurationError.value) {
    store.dispatch('growl/error', {
      title: t('epinio.growl.serviceInstance.bind.error.title'),
      message: t('epinio.growl.serviceInstance.bind.error.message'),
    });
  }
  if (unbindConfigurationError.value) {
    store.dispatch('growl/error', {
      title: t('epinio.growl.serviceInstance.unbind.error.title'),
      message: t('epinio.growl.serviceInstance.unbind.error.message'),
    });
  }
});

const handleSuccess = (type: 'create' | 'update') => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.configuration.${type}.success.title`),
    message: t(`epinio.growl.configuration.${type}.success.message`, { name: formName.value }),
  });
};

async function fetchApplications() {
  if (!formNamespace.value) return;

  if (cachedApplications.value.length > 0) {
    fetchedApplications.value = cachedApplications.value;
    return;
  }

  isLoadingApplications.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/applications?namespaces=${formNamespace.value}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.APP, ...item })
    ));
    fetchedApplications.value = classifiedData;
    cachedApplications.value = classifiedData;
  } catch (error) {
    console.error('Failed to fetch applications', error);
  } finally {
    isLoadingApplications.value = false;
  }
}  

async function searchApplications(query: string) {
  if (!formNamespace.value) return;

  isLoadingApplications.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/applications?namespaces=${formNamespace.value}&search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.APP, ...item })
    ));
    fetchedApplications.value = classifiedData;
  } catch {
    fetchedApplications.value = [];
  } finally {
    isLoadingApplications.value = false;
  }
}

// watch namespace changes to fetch applications for the selected namespace
watch(formNamespace, (newNamespace) => {
  if (newNamespace) {
    fetchedApplications.value = [];
    cachedApplications.value = [];
    fetchApplications();
  }
}, { immediate: true });

defineExpose({ openCreate, openView, openEdit });
</script>

<template>
  <!-- Hidden file inputs rendered outside the modal to prevent focus-return from closing it -->
  <input
    ref="bulkFileInput"
    type="file"
    class="hidden-file-input"
    @change="onBulkFileChange"
    @cancel="fileDialogActive = false"
  >
  <input
    ref="rowFileInput"
    type="file"
    class="hidden-file-input"
    @change="onRowFileChange"
    @cancel="fileDialogActive = false"
  >

  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="modalTitle"
    :subtitle="modalSubtitle"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <!-- Service-managed notice: shown when a config was created by a service (not directly by a user) -->
      <Banner
        v-if="!isCreate && configModel?.configuration?.origin"
        color="info"
        :label="`This configuration is managed by the '${configModel.configuration.origin}' service. It cannot be edited or deleted here. To make changes, update the '${configModel.configuration.origin}' service.`"
      />

      <trailhand-form-card>
        <!-- Namespace + Name -->
        <trailhand-form-row columns="2">
          <trailhand-dropdown
            style="width: 100%"
            :options="namespaceOpts"
            :value="formNamespace"
            label="Namespace"
            placeholder="Select a namespace"
            :disabled="isEdit || isView"
            :required="!isView"
            filterable
            @dropdown-change="(e: CustomEvent) => { formNamespace = e.detail.value; selectedApps = []; }"
            @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onNamespaceFilter(e.detail.filter); }"
            :isLoading="isLoadingNamespaces"
          ></trailhand-dropdown>
          <trailhand-text-input
            :value="formName"
            label="Name"
            :required="isCreate"
            :disabled="!isCreate"
            placeholder="A unique name"
            @text-input-change="(e: CustomEvent) => { formName = e.detail.value; }"
          />
        </trailhand-form-row>

        <!-- Bind to Application -->
        <trailhand-form-row>
          <ResourceDropdown
            :values="selectedApps"
            :options="nsAppOptions"
            label="Bind to Application (Optional)"
            :disabled="isView || !formNamespace"
            filterable
            multiselect
            placeholder="Select applications to bind"
            :onDropdownChange="(e: CustomEvent) => { selectedApps = e.detail.values; }"
            :fetchAllResources="fetchApplications"
            :searchResources="searchApplications"
            :isLoading="isLoadingApplications"
          />
        </trailhand-form-row>

        <!-- Config Data -->
        <div class="config-data-section">
          <div class="config-data-section-title">
            Config Data
          </div>
          <div class="config-data-table">
            <div
              v-if="configData.length === 0 && !isEditing"
              class="config-data-empty"
            >
              No configuration data.
            </div>
            <template v-if="configData.length > 0 || isEditing">
              <div class="config-data-header">
                <span>Name <span class="required">*</span></span>
                <span>Value <span class="required">*</span></span>
                <span />
                <span />
              </div>
              <div
                v-for="(row, i) in configData"
                :key="i"
                class="config-data-row"
              >
                <trailhand-text-input
                  :value="row.key"
                  placeholder="e.g. foo"
                  :disabled="isView"
                  @text-input-change="(e: CustomEvent) => updateRowKey(i, e.detail.value)"
                />
                <div class="value-cell">
                  <trailhand-code-editor
                    :value="row.value"
                    :disabled="isView"
                    @code-input-change="(e: CustomEvent) => updateRowValue(i, e.detail.value)"
                  />
                </div>
                <button
                  v-if="isEditing"
                  class="upload-link"
                  @click="triggerValueFileUpload(i)"
                >
                  Upload
                </button>
                <button
                  v-if="isEditing"
                  class="remove-link"
                  @click="removeRow(i)"
                >
                  Remove
                </button>
              </div>
            </template>
            <div
              v-if="isEditing"
              class="config-data-actions"
            >
              <trailhand-button
                variant="secondary"
                size="small"
                @button-click="addRow"
              >
                Add
              </trailhand-button>
              <trailhand-button
                variant="secondary"
                size="small"
                @button-click="triggerBulkFileUpload"
              >
                Read From File
              </trailhand-button>
            </div>
          </div>
        </div>
      </trailhand-form-card>

      <Banner
        v-if="createConfigurationError || updateConfigurationError"
        color="error"
        :label="createConfigurationErrorData?.message || updateConfigurationErrorData?.message || t('epinio.services.errors.save')"
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
          v-if="configModel?.configuration?.type === 'custom'"
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
          :disabled="!validationPassed || isCreatingConfiguration || isUpdatingConfiguration"
          @button-click="onSubmit"
        >
          {{ isEdit ? (isUpdatingConfiguration ? t('generic.updating') : t('generic.save')) : (isCreatingConfiguration ? t('generic.creating') : t('generic.create')) }}
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
  width: 700px;
}

.config-data-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--body-text);
  margin-bottom: 12px;
}

.config-data-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.config-data-empty {
  color: var(--muted);
  font-size: 13px;
}

.config-data-header {
  display: grid;
  grid-template-columns: 0.8fr 1fr 40px 40px;
  gap: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--body-text);
  padding-top: 2px;

  .required {
    color: var(--error);
  }
}

.config-data-row {
  display: grid;
  grid-template-columns: 0.8fr 1fr 40px 40px;
  gap: 8px;
  align-items: center;
}

.value-cell {
  position: relative;
  display: flex;
  align-items: center;

  trailhand-text-input {
    width: 100%;
  }
}

.upload-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--link);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.remove-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--error);
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }
}

.config-data-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.hidden-file-input {
  display: none;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>