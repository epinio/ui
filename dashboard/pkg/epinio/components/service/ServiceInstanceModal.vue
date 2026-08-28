<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';
import ResourceDropdown from '../application/ResourceDropdown.vue';
import { useNamespaces } from '../../utils/namespaces';

import isEqual from 'lodash/isEqual';

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

// Captured separately so background list polls (which omit internal_routes) can't wipe it
const internalRoutes = ref<string[]>([]);

const isLoadingCatalogServices = ref(false);
const cachedCatalogServices = ref<any[]>([]);
const fetchedCatalogServices = ref<any[]>([]);

const isLoadingApplications = ref(false);
const cachedApplications = ref<any[]>([]);
const fetchedApplications = ref<any[]>([]);

const {
  options:   namespaceOpts,
  isLoading: isLoadingNamespaces,
  firstName: firstNamespace,
  fetchAll:  fetchNamespaces,
  search:    searchNamespaces,
  seed:      seedNamespace,
} = useNamespaces(store, {
  scopeToActiveFilter: true
});

const catalogServiceOpts = computed(() =>
  fetchedCatalogServices.value.map((cs: any) => ({
    label: `${cs.name} (${cs.short_description})`,
    value: cs.name,
  }))
);

const nsAppOptions = computed(() => {
  if (!formNamespace.value) return [];

  return fetchedApplications.value
    .map((a: any) => ({ label: a.meta.name, value: a.meta.name }));
});

const selectedCatalogService = computed(() =>
  fetchedCatalogServices.value.find((cs: any) => cs.name === formCatalogService.value)
);

const showChartValues = computed(() =>
  Object.keys(selectedCatalogService.value?.settings || {}).length !== 0 || (isEdit.value && Object.keys(chartValues).length !== 0)
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

async function openCreate(prefilledCatalogService?: string) {
  errors.value = [];
  modalMode.value = 'create';

  serviceModel.value = null;
  formNamespace.value = '';
  formName.value = '';
  formCatalogService.value = prefilledCatalogService || '';

  selectedApps.value = [];
  initialBoundApps.value = [];
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};

  // Open first so the user sees the modal while the namespaces load, then
  // default to the first one as before.
  showModal.value = true;

  await fetchNamespaces();

  if (!formNamespace.value) {
    formNamespace.value = firstNamespace.value;
  }
}

function openView(row: any) {
  errors.value = [];
  modalMode.value = 'view';

  serviceModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  seedNamespace(formNamespace.value);
  formName.value = row.name || row.meta?.name || '';
  formCatalogService.value = row.catalog_service || '';
  internalRoutes.value = [];

  selectedApps.value = [...(row.boundapps || [])];
  initialBoundApps.value = [...(row.boundapps || [])];

  const settings = objValuesToString(row.settings || {});

  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  Object.assign(chartValues, settings);
  validChartValues.value = {};

  showModal.value = true;

  // The list endpoint omits internal_routes, fetch the full record and capture routes locally
  // so background list polls (which also omit internal_routes) cannot wipe them.
  row.forceFetch().then(() => {
    if (!showModal.value) return;
    const id = `${ row.meta?.namespace }/${ row.meta?.name || row.name }`;
    const updated = store.getters['epinio/byId'](EPINIO_TYPES.SERVICE_INSTANCE, id);

    if (updated) {
      serviceModel.value = updated;
      internalRoutes.value = [...(updated.internal_routes || [])];
    }
  }).catch(() => {});
}

function openEdit(row: any) {
  errors.value = [];
  modalMode.value = 'edit';

  serviceModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  seedNamespace(formNamespace.value);
  formName.value = row.name || row.meta?.name || '';
  formCatalogService.value = row.catalog_service || '';
  internalRoutes.value = [];

  selectedApps.value = [...(row.boundapps || [])];
  initialBoundApps.value = [...(row.boundapps || [])];

  const settings = objValuesToString(row.settings || {});

  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  Object.assign(chartValues, settings);
  validChartValues.value = {};

  showModal.value = true;

  // The list endpoint omits internal_routes, fetch the full record and capture routes locally
  // so background list polls (which also omit internal_routes) cannot wipe them.
  row.forceFetch().then(() => {
    if (!showModal.value) return;
    const id = `${ row.meta?.namespace }/${ row.meta?.name || row.name }`;
    const updated = store.getters['epinio/byId'](EPINIO_TYPES.SERVICE_INSTANCE, id);

    if (updated) {
      serviceModel.value = updated;
      internalRoutes.value = [...(updated.internal_routes || [])];
    }
  }).catch(() => {});
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
  internalRoutes.value = [];
  serviceModel.value = null;
  showDiscardConfirm.value = false;
  showModal.value = false;
}

function resetChartValues() {
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};
}

// Refresh the whole list, not just the saved record: the table paginates
// server-side, so a single-resource fetch adds an 11th row to a 10-row page
// and leaves the page count stale until the 30s poller catches up.
const refreshServices = () => store
  .dispatch('epinio/refreshList', { type: EPINIO_TYPES.SERVICE_INSTANCE })
  .catch(() => {});

// The Bound Applications column reads from the apps slice, so app bindings
// need that list refreshed too.
const refreshApps = () => store
  .dispatch('epinio/findAll', { type: EPINIO_TYPES.APP, opt: { force: true } })
  .catch(() => {});

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

      // Wait for the install only when apps are waiting to be bound to it
      await svc.create(capturedSelectedApps.length > 0);

      // Re-assert metadata: followLink merges the sparse create response back
      // into the model, which can wipe metadata and break subsequent bind calls
      svc.metadata = { namespace: capturedNamespace, name: capturedName };

      closeModal();

      store.dispatch('growl/success', {
        title:   t('epinio.growl.serviceInstance.create.success.title'),
        message: t('epinio.growl.serviceInstance.create.success.message', { name: capturedName }),
      });

      // Show the new item quickly, then bind apps and refresh again once done
      refreshServices();
      if (capturedSelectedApps.length) {
        Promise.all(capturedSelectedApps.map((app: string) => svc.bindApp(app)))
          .then(() => {
            refreshApps();
            refreshServices();
          })
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
      const serviceName = svc.meta?.name;

      closeModal();

      store.dispatch('growl/success', {
        title:   t('epinio.growl.serviceInstance.update.success.title'),
        message: t('epinio.growl.serviceInstance.update.success.message', { name: serviceName }),
      });

      // Bind/unbind and refresh in the background
      Promise.all([
        ...newBindApps.map((a: string) => svc.bindApp(a)),
        ...unbindApps.map((a: string) => svc.unbindApp(a)),
      ]).then(() => {
        refreshApps();
        refreshServices();
      }).catch(() => {});
      svc.forceFetch().catch(() => {});
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
    store.dispatch('growl/error', {
      title: isEdit.value
        ? t('epinio.growl.serviceInstance.save.error.updateTitle')
        : t('epinio.growl.serviceInstance.save.error.createTitle'),
      message: t('epinio.growl.serviceInstance.save.error.message'),
    });
  } finally {
    saving.value = false;
  }
}

const fetchCatalogServices = async () => {
  if (cachedCatalogServices.value.length > 0) {
    fetchedCatalogServices.value = cachedCatalogServices.value;
    return;
  }
  isLoadingCatalogServices.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/catalogservices`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];

    // classify raw JSON into proper model instances
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.CATALOG_SERVICE, ...item })
    ));
    fetchedCatalogServices.value = classifiedData;
    cachedCatalogServices.value = classifiedData;
  } catch (error) {
    console.error('Failed to fetch services', error);
  } finally {
    isLoadingCatalogServices.value = false;
  }
};

async function searchCatalogServices(query: string) {
  isLoadingCatalogServices.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/catalogservices?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.CATALOG_SERVICE, ...item })
    ));
    fetchedCatalogServices.value = classifiedData;
  } catch {
    fetchedCatalogServices.value = [];
  } finally {
    isLoadingCatalogServices.value = false;
  }
}

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
          <ResourceDropdown
            :value="formNamespace"
            :options="namespaceOpts"
            label="Namespace"
            placeholder="Select a namespace"
            :disabled="isEdit || isView"
            :required="!isView"
            :onDropdownChange="(e: CustomEvent) => { formNamespace = e.detail.value; selectedApps = []; }"
            :fetchAllResources="fetchNamespaces"
            :searchResources="searchNamespaces"
            :isLoading="isLoadingNamespaces"
          />
          <trailhand-text-input
            :value="formName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isEdit || isView"
            @text-input-change="(e: CustomEvent) => { formName = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>

        <!-- Catalog Service + Version (version only in view/edit, 3/4 + 1/4 split via 4-col grid) -->
        <trailhand-form-row :columns="(isView || isEdit) ? '4' : '1'">
          <ResourceDropdown
            :value="formCatalogService"
            :options="catalogServiceOpts"
            :label="'Catalog Service'"
            :disabled="isEdit || isView"
            filterable
            placeholder="Select the type of service to create"
            :onDropdownChange="(e: CustomEvent) => { formCatalogService = e.detail.value; resetChartValues(); }"
            :fetchAllResources="fetchCatalogServices"
            :searchResources="searchCatalogServices"
            :isLoading="isLoadingCatalogServices"
          />
          <trailhand-text-input
            v-if="isView || isEdit"
            :value="serviceModel?.catalog_service_version || ''"
            label="Cat. Service Version"
            :disabled="true"
          ></trailhand-text-input>
        </trailhand-form-row>

        <!-- Internal Routes (view/edit only, populated after individual fetch) -->
        <trailhand-form-row v-if="(isView || isEdit) && internalRoutes.length">
          <trailhand-code-editor
            style="width: 100%"
            :value="internalRoutes.join('\n')"
            label="Internal Routes"
            :disabled="true"
          ></trailhand-code-editor>
        </trailhand-form-row>

        <!-- Bind to Application -->
        <trailhand-form-row>
        <ResourceDropdown
          :values="selectedApps"
          :options="nsAppOptions"
          label="Bind to Application (Optional)"
          :disabled="isView"
          filterable
          multiselect
          placeholder="Select applications to bind"
          :onDropdownChange="(e: CustomEvent) => { selectedApps = e.detail.values; }"
          :fetchAllResources="fetchApplications"
          :searchResources="searchApplications"
          :isLoading="isLoadingApplications"
        />
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
