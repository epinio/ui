<script setup lang="ts">
import { computed, ref, reactive, watchEffect, watch } from 'vue';
import { useStore } from 'vuex';
import { EPINIO_TYPES } from '../../types';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';
import { useCreateServiceInstance, useBindServiceInstance, useUnbindServiceInstance, useUpdateServiceInstance } from '../../queries/useServiceMutations';
import { ServiceInstance } from '../../models/service/ui-types';
import { useNamespaces } from '../../queries/useNamespaceQueries';
import ResourceDropdown from '../application/ResourceDropdown.vue';
import { debounce } from 'lodash';
import { ListResourceRequestParams } from '../../models/resource/ui-types';

import isEqual from 'lodash/isEqual';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');
// Model instance, used only for API calls
const serviceModel = ref<ServiceInstance | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const formNamespace = ref('');
const formName = ref('');
const formCatalogService = ref('');

const initialBoundApps = ref<string[]>([]);
const selectedApps = ref<string[]>([]);
const chartValues = reactive<Record<string, any>>({});
const validChartValues = ref<Record<string, boolean>>({});

const isLoadingCatalogServices = ref(false);
const cachedCatalogServices = ref<any[]>([]);
const fetchedCatalogServices = ref<any[]>([]);

const isLoadingApplications = ref(false);
const cachedApplications = ref<any[]>([]);
const fetchedApplications = ref<any[]>([]);

const namespaceRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const namespaceRequestOptions = ref({ enabled: false, polling: false });
const {data: namespaces, isLoading: isLoadingNamespaces, isError: isErrorNamespaces, error: namespacesError} = useNamespaces(store, namespaceRequestParams, namespaceRequestOptions);

const {mutateAsync: createService, isPending: isCreatingService, isError: createServiceError, error: createServiceErrorData} = useCreateServiceInstance(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: bindService, isPending: isBindingService, isError: bindServiceError, error: bindServiceErrorData} = useBindServiceInstance(store);
const {mutateAsync: unbindService, isPending: isUnbindingService, isError: unbindServiceError, error: unbindServiceErrorData} = useUnbindServiceInstance(store);
const {mutateAsync: updateService, isPending: isUpdatingService, isError: updateServiceError, error: updateServiceErrorData} = useUpdateServiceInstance(store, () => {
  handleSuccess('update');
  closeModal();
});

// Captured separately so background list polls (which omit internal_routes) can't wipe it
const internalRoutes = ref<string[]>([]);

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

// TODO: replace with tanstack queries once ready for service catalog
const catalogServiceOpts = computed(() =>
  fetchedCatalogServices.value.map((cs: any) => ({
    label: `${cs.name} (${cs.short_description})`,
    value: cs.name,
  }))
);

// TODO: replace with tanstack queries once ready for applications
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
  modalMode.value = 'create';

  serviceModel.value = null;
  formNamespace.value = '';
  formName.value = '';
  formCatalogService.value = prefilledCatalogService || '';

  selectedApps.value = [];
  initialBoundApps.value = [];
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};

  namespaceRequestOptions.value.enabled = true;
  showModal.value = true;
}

function populateForm(row: ServiceInstance) {
  serviceModel.value = row;
  formNamespace.value = row.meta?.namespace || '';
  formName.value = row.meta?.name || '';
  formCatalogService.value = row.catalogService || '';
  internalRoutes.value = [...(row.internalRoutes || [])];

  selectedApps.value = [...(row.boundApps || [])];
  initialBoundApps.value = [...(row.boundApps || [])];

  const settings = objValuesToString(row.settings || {});

  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  Object.assign(chartValues, settings);
  validChartValues.value = {};
}

function openView(row: ServiceInstance) {
  modalMode.value = 'view';

  populateForm(row);
  
  namespaceRequestOptions.value.enabled = true;
  showModal.value = true;
}

function openEdit(row: ServiceInstance) {
  modalMode.value = 'edit';

  populateForm(row);

  namespaceRequestOptions.value.enabled = true;
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
  internalRoutes.value = [];
  serviceModel.value = null;
  showDiscardConfirm.value = false;
  namespaceRequestOptions.value.enabled = false;
  namespaceRequestParams.value.page = 1;
  namespaceRequestParams.value.search = '';
  showModal.value = false;
}

function resetChartValues() {
  Object.keys(chartValues).forEach(k => delete chartValues[k]);
  validChartValues.value = {};
}

async function onSubmit() {
  if (!validationPassed.value || isCreatingService.value || isUpdatingService.value) return;

  if (!isEdit.value) {
    // Capture values before closeModal() wipes form state
    const capturedNamespace = formNamespace.value;
    const capturedName = formName.value;
    const capturedSelectedApps = [...selectedApps.value];

    const cleanSettings = { ...chartValues };

    delete cleanSettings.value;
    const request = {
      name: capturedName,
      catalogService: formCatalogService.value,
      settings: cleanSettings,
      wait: capturedSelectedApps.length > 0,
    };

    await createService({ namespace: capturedNamespace, request });

    if (capturedSelectedApps.length) {
      Promise.all(capturedSelectedApps.map((app: string) => bindService({ namespace: capturedNamespace, serviceName: capturedName, request: { appName: app } })))
    }
  } else {
    const svc = {...serviceModel.value};
    if (!svc) throw new Error('Service model is missing');
    const newSettings = !isEqual(
      objValuesToString(chartValues),
      objValuesToString(svc.settings || {})
    );

    if (newSettings) {
      const cleanSettings = { ...chartValues };

      delete cleanSettings.value;
      const request = {
        settings: cleanSettings,
        wait: selectedApps.value.length > 0,
      };
      await updateService({ namespace: svc.meta?.namespace || '', serviceName: svc.meta?.name || '', request });
    }

    const bindApps = selectedApps.value;
    const unbindApps = initialBoundApps.value.filter(a => !bindApps.includes(a));
    const newBindApps = bindApps.filter(a => !initialBoundApps.value.includes(a));
    const serviceName = svc.meta?.name;

    if (showModal.value) {
      closeModal();
    }

    // Bind/unbind and refresh in the background
    Promise.all([
      ...newBindApps.map((a: string) => bindService({ namespace: svc.meta?.namespace || '', serviceName: serviceName || '', request: { appName: a } })),
      ...unbindApps.map((a: string) => unbindService({ namespace: svc.meta?.namespace || '', serviceName: serviceName || '', request: { appName: a } })),
    ]).then(() => {
      store.dispatch('growl/success', {
        title:   t(`epinio.growl.service.both.success.title`),
        message: t(`epinio.growl.service.both.success.message`, { name: svc.meta?.name }),
      });
    })
  }
}

watchEffect(() => {
  if (bindServiceError.value) {
    store.dispatch('growl/error', {
      title: t('epinio.growl.serviceInstance.bind.error.title'),
      message: t('epinio.growl.serviceInstance.bind.error.message'),
    });
  }
  if (unbindServiceError.value) {
    store.dispatch('growl/error', {
      title: t('epinio.growl.serviceInstance.unbind.error.title'),
      message: t('epinio.growl.serviceInstance.unbind.error.message'),
    });
  }
});

const handleSuccess = (type: 'create' | 'update') => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.serviceInstance.${type}.success.title`),
    message: t(`epinio.growl.serviceInstance.${type}.success.message`, { name: formName.value }),
  });
};

const onNamespaceFilter = debounce((query: string) => {
  namespaceRequestParams.value.page = 1;
  namespaceRequestParams.value.search = query;
}, 500);

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
            :value="serviceModel?.catalogServiceVersion || ''"
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
        v-if="createServiceError || updateServiceError"
        color="error"
        :label="createServiceErrorData?.message || updateServiceErrorData?.message || t('epinio.services.errors.save')"
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
          :disabled="!validationPassed || isCreatingService || isUpdatingService"
          @button-click="onSubmit"
        >
          {{ isEdit ? (isUpdatingService ? t('generic.updating') : t('generic.save')) : (isCreatingService ? t('generic.creating') : t('generic.create')) }}
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
