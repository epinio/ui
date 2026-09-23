<script setup lang="ts">

import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

import Application from '../../models/applications';
import {
  APPLICATION_SOURCE_TYPE,
  APPLICATION_BUILD_MODE,
  EpinioInfo,
  EpinioAppSource,
} from '../../types';
import { EpinioAppInfo } from '../../types';
import { useBuilderImages } from '../../queries/useBuilderImagesQueries';
import { useAppCharts } from '../../queries/useAppChartsQueries';
import { ListResourceRequestParams, ResourceQueryOptions } from '../../models/resource/ui-types';
import { debounce } from 'lodash';

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

const isEdit = computed(() => props.mode === 'edit');
const isView = computed(() => props.mode === 'view');

// Set when the catalog read is refused, which is a valid role, not a fault.
const builderImagesForbidden = ref(false);

const appChart = ref(props.application.configuration?.appchart || props.source?.appChart || '');
const type = ref(props.source?.type || APPLICATION_SOURCE_TYPE.FOLDER);
const builderImage = ref(props.source?.builderImage || '');
const buildMode = ref(props.source?.buildMode || APPLICATION_BUILD_MODE.BUILDPACK);
const dockerfilePath = ref(props.source?.dockerfilePath || 'Dockerfile');
const dockerfilePathError = ref('');

const appChartsRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const appChartsRequestOptions = ref<ResourceQueryOptions>({ enabled: true, polling: false });
const {data: appChartsData, isLoading: isLoadingAppCharts, isError: isErrorAppCharts } = useAppCharts(store, appChartsRequestParams, appChartsRequestOptions);
const onAppChartsFilter = debounce((query: string) => {
  appChartsRequestParams.value.page = 1;
  appChartsRequestParams.value.search = query;
}, 500);
  // If no app chart is set from the source or application configuration
  // default to the standard app chart.
watch(appChartsData, () => {
  if (appChart.value) return;
  const standardAppChart = appChartsData.value?.items?.find((ac) => ac.meta.name === 'standard');
  appChart.value = (
    props.application.configuration?.appchart ||
    props.source?.appChart ||
    standardAppChart?.meta.name ||
    appChartsData.value?.items?.[0]?.meta.name ||
    ''
  );
  update();
});

const builderImageRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const builderImageRequestOptions = ref<ResourceQueryOptions>({ enabled: true, polling: false });
const {data: builderImagesData, isLoading: isLoadingBuilderImages, isError: isErrorBuilderImages } = useBuilderImages(store, builderImageRequestParams, builderImageRequestOptions);
const onBuilderImageFilter = debounce((query: string) => {
  builderImageRequestParams.value.page = 1;
  builderImageRequestParams.value.search = query;
}, 500);
// If no builder image is set from the source, default to the catalog's default or
// its first entry. `custom` is a sentinel, not an image, so it is filtered out --
// seeding it would stage the literal string. Empty means the server picks.
watch(builderImagesData, () => {
  if (builderImage.value) return;
  const defaultBuilderImage = builderImagesData.value?.items?.find((bi: any) => bi.default)?.image || '';
  builderImage.value = defaultBuilderImage;
  update();
});

// Get the builder images from the store, add custom option and format for dropdown
const allBuilderImages = computed(() => {
  const catalogImages = (builderImagesData.value?.items || []).map((bi) => ({
    value: bi.image,
    label: `${bi.meta.name} (${bi.shortDescription})`,
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

</script>

<template>
    <div>
      <div class="spacer source">
        <trailhand-dropdown
          style="width: 100%"
          :options="(appChartsData?.items || []).map((ac) => ({ value: ac.meta.name, label: `${ac.meta.name} (${ac.shortDescription})` }))"
          :value="appChart"
          label="Application Chart"
          placeholder="Select an application chart"
          :disabled="isEdit || isView"
          :required="!isView"
          filterable
          @dropdown-change="(e: CustomEvent) => { appChart = e.detail.value; update(); }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onAppChartsFilter(e.detail.filter); }"
          :isLoading="isLoadingAppCharts"
        ></trailhand-dropdown>
        <p v-if="isErrorAppCharts" class="error-message">
          {{ t(`epinio.appCharts.errors.fetchAll`) }}
        </p>
      </div>

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
          <p v-if="dockerfilePathError" class="error-message">
            {{ dockerfilePathError }}
          </p>
        </div>
      </template>

      <template v-if="showBuilderImage">
        <div class="spacer source builder-image">
          <h4>Paketo Builder Image</h4>
          <trailhand-dropdown
            v-if="!builderImagesForbidden"
            style="width: 100%"
            :options="allBuilderImages"
            :value="selectedBuilderImage"
            label="Builder Image"
            placeholder="Select a builder image"
            :disabled="isEdit || isView"
            :required="!isView"
            filterable
            @dropdown-change="(e: CustomEvent) => { handleBuilderImageDropdownChange(e.detail.value) }"
            @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onBuilderImageFilter(e.detail.filter); }"
            :isLoading="isLoadingBuilderImages"
          ></trailhand-dropdown>
          <p v-if="isErrorBuilderImages" class="error-message">
            {{ t(`epinio.builderImages.errors.fetchAll`) }}
          </p>
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
</template>


<style lang="scss" scoped>
.builder-image {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.error-message {
  color: var(--error);
  font-size: 0.9em;
  margin-top: 4px;
}
</style>
