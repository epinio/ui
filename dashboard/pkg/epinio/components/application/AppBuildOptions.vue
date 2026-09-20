<script setup lang="ts">

import { ref, reactive, computed, onMounted, watch, watchEffect } from 'vue';
import { useStore } from 'vuex';
import jsyaml from 'js-yaml';

import Application from '../../models/applications';
import GitPicker from './GitPicker.vue';
import { sortBy } from '@shell/utils/sort';
import { generateZip } from '@shell/utils/download';
import {
  APPLICATION_SOURCE_TYPE,
  APPLICATION_BUILD_MODE,
  EpinioApplicationChartResource,
  EpinioInfo,
  EpinioAppSource,
  EPINIO_APP_MANIFEST
} from '../../types';
import { EpinioAppInfo } from '../../types';
import { _EDIT } from '@shell/config/query-params';
import { AppUtils } from '../../utils/application';
import { EPINIO_TYPES } from '../../types';
import { isForbidden } from '../../utils/errors';
import ResourceDropdown from './ResourceDropdown.vue';

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{
  application: Application;
  source?: EpinioAppSource;
  info?: EpinioInfo;
  mode: string;
  active: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', payload: any): void;
  (e: 'changeAppInfo', info: EpinioAppInfo): void;
  (e: 'changeAppConfig', configs: string[]): void;
  (e: 'valid', valid: boolean): void;
}>();

const isEdit = computed(() => props.mode === _EDIT);
const isView = computed(() => props.mode === 'view');

const isLoadingAppCharts = ref(false);
const appCharts = ref<any[]>([]);
const cachedAppCharts = ref<any[]>([]);

const isLoadingBuilderImages = ref(false);
const builderImages = ref<any[]>([]);
const cachedBuilderImages = ref<any[]>([]);
// Set when the catalog read is refused, which is a valid role, not a fault.
const builderImagesForbidden = ref(false);

const isFetchingChartsAndImages = ref<boolean>(true);

const builderImage = ref(props.source?.builderImage || '');
const buildMode = ref(props.source?.buildMode || APPLICATION_BUILD_MODE.BUILDPACK);
const dockerfilePath = ref(props.source?.dockerfilePath || 'Dockerfile');
const dockerfilePathError = ref('');

function validateDockerfilePathValue(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('\\\\')
  ) {
    return t('epinio.applications.steps.source.dockerfilePath.error.absolute');
  }

  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized.split('/').some((part) => part === '..')) {
    return t('epinio.applications.steps.source.dockerfilePath.error.parent');
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    return t('epinio.applications.steps.source.dockerfilePath.error.chars');
  }

  return '';
}

function onDockerfilePathChange(value: string) {
  dockerfilePath.value = value;
  dockerfilePathError.value = validateDockerfilePathValue(value);
  update();
}


const appChart = ref(props.application.configuration?.appchart || props.source?.appChart || '');
const type = ref(props.source?.type || APPLICATION_SOURCE_TYPE.FOLDER);

// Get the builder images from the store, add custom option and format for dropdown
const allBuilderImages = computed(() => {
  const catalogImages = sortBy(builderImages.value, 'meta.name', false).map((bi: any) => ({
    value: bi.image,
    label: `${bi.meta.name} (${bi.short_description})`,
    default: bi.default
  }))
  const customOption = {
    value: 'custom',
    label: 'Custom',
    default: false
  }
  return [...catalogImages, customOption];
});

const selectedBuilderImage = computed(() => {
  return allBuilderImages.value.some(
    (bi) => bi.value === builderImage.value
  )
    ? builderImage.value
    : 'custom';
});

const isCustomBuilderImage = computed(
  () => selectedBuilderImage.value === 'custom'
);

// An empty builder image is legal when the catalog cannot be read: the server
// resolves its own default (request, then app CR, then default CR, then env).
const hasBuilderImage = computed(
  () => !!builderImage.value || builderImagesForbidden.value
);

const builderImageLabel = computed(() => builderImagesForbidden.value
  ? t('epinio.applications.steps.source.archive.builderimage.clusterDefault')
  : t('epinio.applications.steps.source.archive.builderimage.inputLabel'));

const showBuilderImage = computed(() =>
  [
    APPLICATION_SOURCE_TYPE.ARCHIVE,
    APPLICATION_SOURCE_TYPE.FOLDER,
    APPLICATION_SOURCE_TYPE.GIT_URL,
    APPLICATION_SOURCE_TYPE.GIT_HUB,
    APPLICATION_SOURCE_TYPE.GIT_LAB,
  ].includes(type.value) &&
  buildMode.value === APPLICATION_BUILD_MODE.BUILDPACK
);

const showBuildMode = computed(() =>
  [
    APPLICATION_SOURCE_TYPE.ARCHIVE,
    APPLICATION_SOURCE_TYPE.FOLDER,
    APPLICATION_SOURCE_TYPE.GIT_URL,
    APPLICATION_SOURCE_TYPE.GIT_HUB,
    APPLICATION_SOURCE_TYPE.GIT_LAB,
  ].includes(type.value)
);

const showDockerfilePath = computed(() => showBuildMode.value && buildMode.value === APPLICATION_BUILD_MODE.DOCKERFILE);

const buildModes = [
  { label: t('epinio.applications.steps.source.buildMode.buildpack'), value: APPLICATION_BUILD_MODE.BUILDPACK },
  { label: t('epinio.applications.steps.source.buildMode.dockerfile'), value: APPLICATION_BUILD_MODE.DOCKERFILE },
];

const valid = computed(() => validate());

watch(() => props.active, (isActive) => {
  if (isActive) {
    emit('valid', valid.value)
  }
})

const fetchAppCharts = async () => {
  if (cachedAppCharts.value.length > 0) {
    appCharts.value = cachedAppCharts.value;
    return;
  }
  isLoadingAppCharts.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/appcharts',
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.APP_CHART, ...item })
    ));
    appCharts.value = classifiedData;
    cachedAppCharts.value = classifiedData;
  } catch (error) {
    console.error('Failed to fetch app charts', error);
  } finally {
    isLoadingAppCharts.value = false;
  }
};

async function searchAppCharts(query: string) {
  isLoadingAppCharts.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/appcharts?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.APP_CHARTS, ...item })
    ));
    appCharts.value = classifiedData;
  } catch {
    appCharts.value = [];
  } finally {
    isLoadingAppCharts.value = false;
  }
}

const fetchBuilderImages = async () => {
  if (cachedBuilderImages.value.length > 0) {
    builderImages.value = cachedBuilderImages.value;
    return;
  }
  isLoadingBuilderImages.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/builderimages',
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.BUILDER_IMAGE, ...item })
    ));
    builderImages.value = classifiedData;
    cachedBuilderImages.value = classifiedData;
    builderImagesForbidden.value = false;
  } catch (error: any) {
    builderImagesForbidden.value = isForbidden(error);

    if (!builderImagesForbidden.value) {
      console.error('Failed to fetch builder images', error);
    }
  } finally {
    isLoadingBuilderImages.value = false;
  }
};

async function searchBuilderImages(query: string) {
  isLoadingBuilderImages.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/builderimages?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.BUILDER_IMAGE, ...item })
    ));
    builderImages.value = classifiedData;
  } catch (error: any) {
    builderImagesForbidden.value = isForbidden(error);
    builderImages.value = [];
  } finally {
    isLoadingBuilderImages.value = false;
  }
}

// Immediate so the parent starts from the form's real validity instead of
// assuming the tab is valid until something changes.
watch(valid, (val) => {
  emit('valid', val);
}, { immediate: true });

function validate() {
  switch (type.value) {
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
    case APPLICATION_SOURCE_TYPE.FOLDER:
      if (buildMode.value === APPLICATION_BUILD_MODE.DOCKERFILE) {
        dockerfilePathError.value = validateDockerfilePathValue(dockerfilePath.value);
        return !!dockerfilePath.value && !dockerfilePathError.value;
      }
      return hasBuilderImage.value;
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      return true;
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      if (buildMode.value === APPLICATION_BUILD_MODE.DOCKERFILE) {
        dockerfilePathError.value = validateDockerfilePathValue(dockerfilePath.value);
        return !!dockerfilePath.value && !dockerfilePathError.value;
      }
      return hasBuilderImage.value;
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      if (buildMode.value === APPLICATION_BUILD_MODE.DOCKERFILE) {
        dockerfilePathError.value = validateDockerfilePathValue(dockerfilePath.value);
        return !!dockerfilePath.value && !dockerfilePathError.value;
      }
      return hasBuilderImage.value;
  }
  return false;
}

function update() {
  emit('change', {
    builderImage: builderImage.value,
    buildMode: buildMode.value,
    dockerfilePath: dockerfilePath.value,
    appChart: appChart.value,
  });
}

function handleBuilderImageDropdownChange(value: string) {
  if (value === 'custom') {
    builderImage.value = '';
  } else {
    builderImage.value = value;
  }
  update();
}

onMounted(async () => {
  await Promise.all([fetchAppCharts(), fetchBuilderImages()]);
  // If no app chart is set from the source or application configuration
  // default to the standard app chart.
  if (!appChart.value) {
    const standardAppChart = appCharts.value.find((ac) => ac.meta.name === 'standard');
    appChart.value = (
      props.application.configuration?.appchart ||
      props.source?.appChart ||
      standardAppChart?.meta.name ||
      appCharts.value[0]?.meta.name ||
      ''
    );
  }
  // If no builder image is set from the source, default to the catalog's default or
  // its first entry. `custom` is a sentinel, not an image, so it is filtered out --
  // seeding it would stage the literal string. Empty means the server picks.
  if (!builderImage.value) {
    const catalogImages = allBuilderImages.value.filter((bi: any) => bi.value !== 'custom');
    const defaultImage = catalogImages.find((bi: any) => bi.default);

    builderImage.value = defaultImage?.value || catalogImages[0]?.value || '';
  }
  isFetchingChartsAndImages.value = false;
  update();
});

</script>

<template>
    <div class="spacer source">
      <div
        v-if="isFetchingChartsAndImages"
        class="spacer"
      >
        <trailhand-loading-spinner />
      </div>

      <div v-else>
        <ResourceDropdown
          :value="appChart"
          :options="appCharts.map((ap: EpinioApplicationChartResource) => ({
            value: ap.meta.name,
            label: `${ap.meta.name} (${ap.short_description})`
          }))"
          :label="t('epinio.applications.steps.source.archive.appchart.label')"
          :disabled="isView"
          placeholder="Select an application chart"
          :onDropdownChange="(e: CustomEvent) => { appChart = e.detail.value; update(); }"
          :fetchAllResources="fetchAppCharts"
          :searchResources="searchAppCharts"
          :isLoading="isLoadingAppCharts"
        />

        <template v-if="showBuildMode">
          <div class="spacer source">
            <h4>{{ t('epinio.applications.steps.source.buildMode.label') }}</h4>
            <trailhand-dropdown
              style="width: 100%;"
              :options="buildModes"
              :value="buildMode"
              data-testid="epinio_app-source_build-mode"
              :label="t('epinio.applications.steps.source.buildMode.inputLabel')"
              @dropdown-change="(e: CustomEvent) => { buildMode = e.detail.value; update(); }"
            />
          </div>
        </template>

        <template v-if="showDockerfilePath">
          <div class="spacer source">
            <h4>{{ t('epinio.applications.steps.source.dockerfilePath.label') }}</h4>
            <trailhand-text-input
              style="width: 100%;"
              :value="dockerfilePath"
              data-testid="epinio_app-source_dockerfile-path"
              :label="t('epinio.applications.steps.source.dockerfilePath.inputLabel')"
              :required="true"
              @text-input-change="(e: CustomEvent) => { onDockerfilePathChange(e.detail.value); }"
            />
            <p v-if="dockerfilePathError" class="error">
              {{ dockerfilePathError }}
            </p>
          </div>
        </template>

        <template v-if="showBuilderImage">
          <div class="spacer source builder-image">
            <h4>Paketo Builder Image</h4>
            <ResourceDropdown
              v-if="!builderImagesForbidden"
              :value="selectedBuilderImage"
              :options="allBuilderImages"
              label="Builder Image"
              :onDropdownChange="(e: CustomEvent) => { handleBuilderImageDropdownChange(e.detail.value) }"
              :fetchAllResources="fetchBuilderImages"
              :searchResources="searchBuilderImages"
              :isLoading="isLoadingBuilderImages"
            />
            <trailhand-text-input
              style="width: 100%;"
              :value="builderImage"
              data-testid="epinio_app-source_builder-value"
              :label="builderImageLabel"
              :placeholder="props.info?.default_builder_image"
              :disabled="!isCustomBuilderImage"
              @text-input-change="(e: CustomEvent) => { builderImage = e.detail.value; update(); }"
            />
          </div>
        </template>
      </div>
    </div>
</template>


<style lang="scss" scoped>
.builder-image {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
