<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { validateSettings } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import ChartSettings from '../settings/ChartSettings.vue';
import { ChartSetting } from '../../models/catalogservice/ui-types';
import {
  useCreateAppChart,
  useUpdateAppChart,
  usePushAppChart,
} from '../../queries/useAppChartsMutations';
import {
  AppChart,
  AppChartUpdateRequest,
  AppChartCreateRequest,
} from '../../models/appcharts/ui-types';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<AppChart | null>(null);
const viewCanEdit = ref(false);

// Form fields (separate from the model to avoid proxy mutation issues)
const chartName = ref('');
const chartShortDescription = ref('');
const chartDescription = ref('');
const helmChartUrl = ref('');
const helmRepoUrl = ref('');
const chartSettings = ref<ChartSetting[]>([]);

// Mirrors maxChartArchiveSize on the server, so an oversized file is named here
// instead of failing as a truncated upload.
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;

const chartSourceTypes = [
  { label: 'Helm URL', value: 'url' },
  { label: 'Upload Archive', value: 'upload' },
];
const chartSource = ref<'url' | 'upload'>('url');
const chartArchive = ref<File | null>(null);
const archiveError = ref('');
const archiveFileInput = ref<HTMLInputElement | null>(null);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

// The upload source of a create. An edit keeps the url fields, and replaces
// the archive of a stored chart through canReplaceArchive.
const isUpload = computed(() => modalMode.value === 'create' && chartSource.value === 'upload');

// Repointing a chart that applications are bound to changes what they deploy on their
// next rebuild, with no version bump and no record. The server refuses it, so lock the
// location instead.
const isLockedByApps = computed(() => isEdit.value && !!initialValues.value?.boundApps);

// A chart uploaded to Epinio lives in a repository of its own, named after the chart:
// oci://<registry>/epinio-charts/<name>. The server never lets its location change, as
// the stored archive would be left behind. The response does not mark such charts, so
// this mirrors the path check of the server (mayBeStored). The server has the last word.
const isStoredByEpinio = computed(() => {
  const name = initialValues.value?.meta?.name;
  const repo = initialValues.value?.helmRepo || '';

  return !!name && repo.startsWith('oci://') && repo.endsWith(`/epinio-charts/${ name }`);
});

const isLocationLocked = computed(() => isEdit.value && (isLockedByApps.value || isStoredByEpinio.value));

// The chart of a stored chart is replaced by uploading a new archive under the same name.
// The server refuses that while applications use the chart, so it is not offered then.
const canReplaceArchive = computed(() => isEdit.value && isStoredByEpinio.value && !isLockedByApps.value);

const {mutateAsync: createAppChart, isPending: isCreatingAppChart, isError: createAppChartError, error: createAppChartErrorData} = useCreateAppChart(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: updateAppChart, isPending: isUpdatingAppChart, isError: updateAppChartError, error: updateAppChartErrorData} = useUpdateAppChart(store, () => {
  handleSuccess('update');
  closeModal();
});
const {mutateAsync: pushAppChart, isPending: isPushingAppChart, isError: pushAppChartError, error: pushAppChartErrorData} = usePushAppChart(store, () => {
  handleSuccess('create');
  closeModal();
});

// Replacing the archive of an existing chart. The other changes of the form are saved first,
// without closing the modal, the push then finishes the edit.
const {mutateAsync: updateAppChartQuietly, isPending: isUpdatingBeforeReplace, isError: updateBeforeReplaceError, error: updateBeforeReplaceErrorData} = useUpdateAppChart(store);
const {mutateAsync: replaceAppChartArchive, isPending: isReplacingArchive, isError: replaceArchiveError, error: replaceArchiveErrorData} = usePushAppChart(store, () => {
  handleSuccess('update');
  closeModal();
});

const isSaving = computed(() => {
  return isCreatingAppChart.value ||
    isUpdatingAppChart.value ||
    isPushingAppChart.value ||
    isUpdatingBeforeReplace.value ||
    isReplacingArchive.value;
});

const saveError = computed(() => {
  if (createAppChartError.value) return createAppChartErrorData.value;
  if (updateAppChartError.value) return updateAppChartErrorData.value;
  if (pushAppChartError.value) return pushAppChartErrorData.value;
  if (updateBeforeReplaceError.value) return updateBeforeReplaceErrorData.value;
  if (replaceArchiveError.value) return replaceArchiveErrorData.value;

  return null;
});

const hasSaveError = computed(() => {
  return createAppChartError.value ||
    updateAppChartError.value ||
    pushAppChartError.value ||
    updateBeforeReplaceError.value ||
    replaceArchiveError.value;
});

const isDirty = computed(() => {
  return dirtyFields.value.name ||
    dirtyFields.value.shortDescription ||
    dirtyFields.value.description ||
    dirtyFields.value.helmChart ||
    dirtyFields.value.helmRepo ||
    dirtyFields.value.settings ||
    !!chartArchive.value;
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

  if (isUpload.value) {
    if (!chartArchive.value || archiveError.value) return false;
  } else {
    if (!helmRepoUrl.value && !helmChartUrl.value) return false;

    const settingsValid = validateSettings(chartSettings.value);
    if (!settingsValid) return false;
  }

  const nameErrors = validateKubernetesName(chartName.value, '', store.getters, undefined, []);
  return nameErrors.length === 0;
});

const canSave = computed(() => {
  const dirty = isDirty.value;
  const valid = validationPassed.value;
  return dirty && valid && !isSaving.value;
});

function openCreate() {
  modalMode.value = 'create';
  chartName.value = '';
  chartShortDescription.value = '';
  chartDescription.value = '';
  helmChartUrl.value = '';
  helmRepoUrl.value = '';
  chartSettings.value = [];
  chartSource.value = 'url';
  chartArchive.value = null;
  archiveError.value = '';
  showModal.value = true;
}

function onChartSourceChange(value: 'url' | 'upload') {
  chartSource.value = value;
  if (value === 'upload') {
    helmChartUrl.value = '';
    helmRepoUrl.value = '';
    chartSettings.value = [];
  } else {
    chartArchive.value = null;
    archiveError.value = '';
  }
}

function handleArchiveFileClick() {
  archiveFileInput.value?.click();
}

function handleArchiveFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // so the same file can be picked again after a failed push

  if (!file) return;

  if (file.size > MAX_ARCHIVE_BYTES) {
    chartArchive.value = null;
    archiveError.value = 'The chart archive is larger than the 32 MiB the server accepts.';
    return;
  }

  chartArchive.value = file;
  archiveError.value = '';
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
  chartSource.value = 'url';
  chartArchive.value = null;
  archiveError.value = '';
  showModal.value = true;
}

// Read-only look at a chart, opened from its name in the list. canEdit decides whether
// the view offers to switch to editing.
function openView(row: AppChart, canEdit = false) {
  openEdit(row);
  modalMode.value = 'view';
  viewCanEdit.value = canEdit;
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
  chartSource.value = 'url';
  chartArchive.value = null;
  archiveError.value = '';
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
  if (!validationPassed.value || !isDirty.value || isSaving.value)
    return;

  if (isUpload.value && chartArchive.value) {
    await pushAppChart({ request: {
      name: chartName.value,
      description: chartDescription.value,
      shortDescription: chartShortDescription.value,
      archive: chartArchive.value,
    } });
  } else if (canReplaceArchive.value && initialValues.value && chartArchive.value) {
    // Read the form before the first request. A successful save resets it.
    const name = initialValues.value.meta.name;
    const pushRequest = {
      name,
      description: chartDescription.value,
      shortDescription: chartShortDescription.value,
      archive: chartArchive.value,
    };

    // The push carries the descriptions. What is left for the update are the settings.
    const request = buildUpdateRequest();
    delete request.description;
    delete request.shortDescription;

    if (Object.keys(request).length > 0) {
      await updateAppChartQuietly({ name, request });
    }
    await replaceAppChartArchive({ request: pushRequest });
  } else if (isEdit.value && initialValues.value) {
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

defineExpose({ openCreate, openEdit, openView });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? chartName || 'App Chart' : 'App Chart'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <trailhand-form-card>
        <Banner
          v-if="initialValues?.boundApps"
          color="warning"
          :label="isLockedByApps
            ? 'One or more applications use this chart, so its location is locked. Repointing it would change what those applications deploy on their next rebuild. Description and settings can still be edited.'
            : 'This chart is currently associated with one or more applications. Editing it may cause issues for future rebuilds.'"
        />
        <Banner
          v-else-if="isEdit && isStoredByEpinio"
          color="info"
          label="This chart is stored in Epinio's registry, so its location is locked. To use a different chart, select a new archive below. Description and settings can still be edited."
        />
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
        <trailhand-form-row v-if="!isEdit && !isView">
          <trailhand-dropdown
            :options="chartSourceTypes"
            :value="chartSource"
            label="Chart Source"
            :required="true"
            @dropdown-change="(e: CustomEvent) => onChartSourceChange(e.detail.value)"
          ></trailhand-dropdown>
        </trailhand-form-row>

        <div v-if="!isUpload">
          <label style="font-size: 11px; color: var(--th-input-label);">Helm URLs - Provide at least one of the following: <span style="color: var(--th-color-red);">*</span></label>
          <trailhand-form-row columns="2">
            <trailhand-text-input
              :value="helmChartUrl"
              label="Helm Chart URL"
              placeholder="e.g. https://example.com/charts/mychart-0.1.0.tgz"
              :disabled="isView || isLocationLocked"
              @text-input-change="(e: CustomEvent) => { helmChartUrl = e.detail.value; }"
            ></trailhand-text-input>
            <trailhand-text-input
              :value="helmRepoUrl"
              label="Helm Repo URL"
              placeholder="e.g. https://example.com/charts/index.yaml"
              :disabled="isView || isLocationLocked"
              @text-input-change="(e: CustomEvent) => { helmRepoUrl = e.detail.value; }"
            ></trailhand-text-input>
          </trailhand-form-row>
        </div>

        <div v-if="isUpload || canReplaceArchive">
          <div class="archive-row">
            <trailhand-text-input
              style="flex: 1"
              :value="chartArchive?.name || ''"
              :label="isUpload ? 'Chart Archive' : 'Replace Chart Archive'"
              placeholder="A .tgz produced by 'helm package'"
              :disabled="true"
              :required="isUpload"
            ></trailhand-text-input>
            <trailhand-button
              variant="alternate"
              @button-click="handleArchiveFileClick"
            >
              Select File
            </trailhand-button>
            <input
              ref="archiveFileInput"
              type="file"
              class="hidden-file-input"
              accept=".tgz,.tar.gz"
              @change="handleArchiveFileChange"
            >
          </div>
          <Banner v-if="archiveError" color="error" :label="archiveError" />
          <Banner
            color="info"
            :label="isUpload
              ? 'Epinio stores the archive in its own registry. Chart settings can be added afterwards by editing the chart.'
              : 'The new archive replaces the chart in Epinio\'s registry. Settings are kept. This is only possible while no application uses the chart.'"
          />
        </div>
        <ChartSettings
          v-if="!isUpload"
          v-model="chartSettings"
          :disabled="isView"
          allow-defaults
        />
      </trailhand-form-card>
      <Banner
        v-if="hasSaveError"
        color="error"
        :label="saveError?.message || t('epinio.appCharts.errors.save')"
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
          v-if="viewCanEdit"
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
          {{ isEdit ? (isSaving ? t('generic.updating') : t('generic.save')) : (isSaving ? t('generic.creating') : t('generic.create')) }}
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

.archive-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
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
