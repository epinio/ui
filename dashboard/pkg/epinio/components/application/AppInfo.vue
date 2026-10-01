<script lang="ts" setup>
import { ref, watch, computed, watchEffect} from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import ChartValues from '../settings/ChartValues.vue';
import { useNamespaces } from '../../queries/useNamespaceQueries';
import { useAppChart } from '../../queries/useAppChartsQueries';
import { ListResourceRequestParams, ResourceQueryOptions } from '../../models/resource/ui-types';
import { debounce } from 'lodash';
import { AppFormDetails, AppFormSource } from '../../models/application/ui-types';
import { ChartSetting } from '../../models/catalogservice/ui-types';

const store = useStore();

const t = store.getters['i18n/t'];

// Props
const props = defineProps<{
  details: AppFormDetails;
  mode: string;
  chart?: string;
  source: AppFormSource;
  active: boolean;
  updateDetails: (newDetails: Partial<AppFormDetails>) => void;
  updateChartSettings: (chartSettings: ChartSetting[]) => void;
}>();

// Reactive state
const bulkFileInput = ref<HTMLInputElement | null>(null);
const fileDialogActive = ref(false);

watch(() => props.chart, (newChart) => {
  appChartRequestOptions.value.enabled = !!newChart;
});
const selectedChart = computed(() => {
  return props.chart || '';
});

const appChartRequestOptions = ref<ResourceQueryOptions>({ enabled: false, polling: false });
const { data: appChart, isLoading: isLoadingAppChart, isError: isErrorAppChart } = useAppChart(store, selectedChart, appChartRequestOptions);

// Watch for changes to the app chart and set default settings if none exist
watch(() => appChart.value?.meta.name, () => {
  if (appChart.value) {
    const defaultSettings: Record<string, string> = {};
    const chartSettings = appChart.value.settings || [];
    chartSettings.forEach((setting) => {
      defaultSettings[setting.name] = props.details.settings[setting.name] ?? setting.value;
    });
    props.updateChartSettings(chartSettings);
    props.updateDetails({ settings: defaultSettings });
  }
});

const namespaceRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const namespaceRequestOptions = ref<ResourceQueryOptions>({ enabled: true, polling: false });
const {data: namespaces, isLoading: isLoadingNamespaces, isError: isErrorNamespaces } = useNamespaces(store, namespaceRequestParams, namespaceRequestOptions);

const namespaceOpts = computed(() => {
  return namespaces?.value?.items.map((ns) => ({ label: ns.meta.name, value: ns.meta.name })) || [];
});

const onNamespaceFilter = debounce((query: string) => {
  namespaceRequestParams.value.page = 1;
  namespaceRequestParams.value.search = query;
}, 500);

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

const isEdit = computed(() => props.mode === 'edit');

watch(() => props.active, (isActive) => {
  if (isActive && !props.details.name) {
    generateDefaultName();
  }
});

// Generate a default name for new applications
const generateDefaultName = () => {
  try {
    // Use source prop if available (create mode), otherwise try appSource (edit mode)
    const source = props.source;

    let baseName = '';

    // Determine base name from source
    if (source.type === 'github' || source.type === 'gitlab') {
      baseName = source[source.type]?.repository || '';
    } else if (source.type === 'gitUrl') {
      // Extract base name from git URL
      const urlParts = source.gitUrl?.url.split('/');
      baseName = urlParts?.length ? urlParts[urlParts.length - 1].replace(/\.git$/, '') : '';
    } else if (source.type === 'containerUrl') {
      // Extract base name from container URL
      const urlParts = source.containerUrl?.url.split('/');
      const imageWithTag = urlParts?.length ? urlParts[urlParts.length - 1] : '';
      baseName = imageWithTag.split(':')[0];
    }
    // Append random string to the end of the base name
    if (baseName) {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      props.updateDetails({name: `${baseName}-${randomSuffix}`.toLowerCase()});
    }
  } catch (e) {
    console.log(e);
    return '';
  }
};

// Allows us to move the checkbox at the top of the list so layout-wise looks better
const moveBooleansToFront = (settings: ChartSetting[]) => {
  if (!settings || !settings.length) {
    return [];
  }

  settings.sort((a, b) => {
    const aValue = a.type === 'bool' ? 0 : 1;
    const bValue = b.type === 'bool' ? 0 : 1;

    return aValue - bValue;
  });

  return settings;
};

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
      const existing = props.details.environment;
      const onlyEmptyRow = existing.length === 1 && !existing[0].key && !existing[0].value;

      props.updateDetails({ environment: onlyEmptyRow ? newRows : [...existing, ...newRows] });
    }
  };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = '';
}

</script>

<template>
  <trailhand-form-card>
    <trailhand-form-row columns="3">
      <div>
        <trailhand-dropdown
          style="width: 100%"
          :options="namespaceOpts"
          :value="details.namespace"
          label="Namespace"
          placeholder="Select a namespace"
          :disabled="isEdit"
          required
          filterable
          @dropdown-change="(e: CustomEvent) => updateDetails({ namespace: e.detail.value })"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onNamespaceFilter(e.detail.filter); }"
          :isLoading="isLoadingNamespaces"
        ></trailhand-dropdown>
        <p v-if="isErrorNamespaces" class="error-message">
          {{ t(`epinio.namespace.errors.fetchAll`) }}
        </p>
      </div>
      <trailhand-text-input
        :value="details.name"
        data-testid="epinio_app-info_name"
        label="Name"
        :placeholder="t('epinio.applications.create.namePlaceholder')"
        :disabled="isEdit"
        required
        @text-input-change="(e: CustomEvent) => updateDetails({ name: e.detail.value })"
      />
      <trailhand-text-input
        :value="details.instances"
        data-testid="epinio_app-info_instances"
        label="Instances"
        :placeholder="t('epinio.applications.create.instancesPlaceholder')"
        required
        type="number"
        min="0"
        @text-input-change="(e: CustomEvent) => updateDetails({ instances: e.detail.value })"
       />
    </trailhand-form-row>
    <div>
      <h3>Routes</h3>
      <div v-for="(route, index) in details.routes" :key="index" class="route-item">
        <trailhand-text-input
          style="flex: 1;"
          :value="route"
          :placeholder="t('epinio.applications.create.routes.placeholder')"
          @text-input-change="(e: CustomEvent) => { updateDetails({ routes: details.routes.map((r, i) => i === index ? e.detail.value : r) }); }"
        />
        <button
          v-if="props.mode !== 'view'"
          class="remove-link"
          @click="() => { updateDetails({ routes: details.routes.filter((_, i) => i !== index) }); }"
        >
          Remove
        </button>
      </div>
      <trailhand-button
        v-if="props.mode !== 'view'"
        variant="alternate"
        @button-click="() => { updateDetails({ routes: [...details.routes, ''] }); }"
      >
        Add Row
      </trailhand-button>
    </div>
    <div v-if="isEdit">
      <Banner color="info">
        {{ t('epinio.applications.create.settingsVars.description') }}
      </Banner>
    </div>
    <div v-if="appChart?.settings">
      <ChartValues
        v-model:value="details.settings"
        :chart="moveBooleansToFront(appChart?.settings)"
        :title="t('epinio.applications.create.settingsVars.title')"
        :mode="props.mode"
        :disabled="false"
      />
    </div>
    <div class="env-var-section">
      <div class="env-var-title-row">
        <h3>{{ t('epinio.applications.create.envvar.title') }}</h3>
      </div>
      <div class="env-var-data">
        <template v-if="details.environment.length > 0 || isEdit">

          <div
            v-for="(envVar, i) in details.environment"
            :key="i"
            class="env-var-row"
          >
            <trailhand-text-input
              style="flex: 1;"
              :value="envVar.key"
              label="Key"
              required
              placeholder="e.g. foo"
              @text-input-change="(e: CustomEvent) => updateDetails({ environment: details.environment.map((env, index) => index === i ? { ...env, key: e.detail.value } : {...env}) })"
            />
            <trailhand-code-editor
              style="flex: 1;"
              :value="envVar.value"
              label="Value"
              required
              @code-input-change="(e: CustomEvent) => updateDetails({ environment: details.environment.map((env, index) => index === i ? { ...env, value: e.detail.value } : {...env}) })"
            />
            <button
              class="remove-link"
              @click="updateDetails({ environment: details.environment.filter((_, index) => index !== i) })"
            >
              Remove
            </button>
          </div>
        </template>
        <div
          class="config-data-actions"
        >
          <trailhand-button
            variant="alternate"
            @button-click="updateDetails({ environment: [...details.environment, { key: '', value: '' }] })"
          >
            Add
          </trailhand-button>
          <trailhand-button
            variant="alternate"
            @button-click="triggerBulkFileUpload"
          >
            Read From File
          </trailhand-button>
          <input
            ref="bulkFileInput"
            type="file"
            class="hidden-file-input"
            @change="onBulkFileChange"
            @cancel="fileDialogActive = false"
          >
        </div>
      </div>
    </div>
  </trailhand-form-card>
</template>

<style scoped>
  .env-var-section {
    width: 100%;
  }

  .env-var-title-row {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 10px;
  }

  .env-var-title-row h3 {
    margin: 0;
    margin-right: 8px;
  }

  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-button .icon {
    width: 25px;
    height: 25px;
  }

  .route-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .env-var-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: flex-end;
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

  .hidden-file-input {
    display: none;
  }

  .error-message {
    color: var(--error);
    font-size: 0.9em;
    margin-top: 4px;
  }
</style>
