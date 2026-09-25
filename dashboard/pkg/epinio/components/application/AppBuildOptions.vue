<script setup lang="ts">

import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import {
  APPLICATION_SOURCE_TYPE,
  APPLICATION_BUILD_MODE,
} from '../../types';
import { useBuilderImages } from '../../queries/useBuilderImagesQueries';
import { useAppCharts } from '../../queries/useAppChartsQueries';
import { ListResourceRequestParams, ResourceQueryOptions } from '../../models/resource/ui-types';
import { debounce } from 'lodash';
import { AppFormBuildOptions } from '../../models/application/ui-types';
import { isForbidden } from '../../utils/errors';

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{
  buildOptions: AppFormBuildOptions;
  sourceType: APPLICATION_SOURCE_TYPE;
  mode: string;
  active: boolean;
  modalOpen: boolean;
  updateBuildOptions: (newBuildOptions: Partial<AppFormBuildOptions>) => void;
}>();

watch(() => props.modalOpen, (newVal) => {
  appChartsRequestOptions.value.enabled = newVal;
  builderImageRequestOptions.value.enabled = newVal;
});

const isEdit = computed(() => props.mode === 'edit');

const dockerfilePathError = ref('');
const defaultBuilderImageForPlaceholder = ref('');

const appChartsRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const appChartsRequestOptions = ref<ResourceQueryOptions>({ enabled: false, polling: false });
const {data: appChartsData, isLoading: isLoadingAppCharts, isError: isErrorAppCharts } = useAppCharts(store, appChartsRequestParams, appChartsRequestOptions);
const onAppChartsFilter = debounce((query: string) => {
  appChartsRequestParams.value.page = 1;
  appChartsRequestParams.value.search = query;
}, 500);


const builderImageRequestParams = ref<ListResourceRequestParams>({ page: 1, pageSize: 25, search: '' });
const builderImageRequestOptions = ref<ResourceQueryOptions>({ enabled: false, polling: false });
const {data: builderImagesData, isLoading: isLoadingBuilderImages, isError: isErrorBuilderImages, error: builderImagesError } = useBuilderImages(store, builderImageRequestParams, builderImageRequestOptions);
const onBuilderImageFilter = debounce((query: string) => {
  builderImageRequestParams.value.page = 1;
  builderImageRequestParams.value.search = query;
}, 500);

// If no app chart is set from the source or application configuration
// default to the standard app chart.
function setDefaultAppChart() {
  if (props.buildOptions.appChart) return;
  const items = appChartsData.value?.items;
  if (!items?.length) return;
  const standard = items.find(ac => ac.meta.name === 'standard');
  props.updateBuildOptions({
    appChart: standard?.meta.name || items[0].meta.name
  });
}
// If no builder image is set from the source, default to the catalog's default or
// its first entry. `custom` is a sentinel, not an image, so it is filtered out --
// seeding it would stage the literal string. Empty means the server picks.
const setDefaultBuilderImage = () => {
  if (props.buildOptions.builderImage) return;
  const defaultBuilderImage = builderImagesData.value?.items?.find((bi: any) => bi.default)?.image || '';
  defaultBuilderImageForPlaceholder.value = defaultBuilderImage;
  props.updateBuildOptions({ builderImage: defaultBuilderImage });
};
watch(appChartsData, setDefaultAppChart);
watch(builderImagesData, setDefaultBuilderImage);
watch(
  () => props.modalOpen,
  (isOpen) => {
    if (isOpen) {
      setDefaultAppChart();
      setDefaultBuilderImage();
    }
  }
);

watch(builderImagesError, (error) => {
  if (isForbidden(error)) {
    props.updateBuildOptions({ builderImagesForbidden: true });
  } else {
    props.updateBuildOptions({ builderImagesForbidden: false });
  }
});

// format the builder images for the dropdown, adding a custom option
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
    (bi) => bi.value === props.buildOptions.builderImage
  )
    ? props.buildOptions.builderImage
    : 'custom';
});

const isCustomBuilderImage = computed(
  () => selectedBuilderImage.value === 'custom'
);

function validateDockerfilePathValue(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    dockerfilePathError.value = t('epinio.applications.steps.source.dockerfilePath.error.required');
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('\\\\')
  ) {
    dockerfilePathError.value = t('epinio.applications.steps.source.dockerfilePath.error.absolute');
  }

  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized.split('/').some((part) => part === '..')) {
    dockerfilePathError.value = t('epinio.applications.steps.source.dockerfilePath.error.parent');
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    dockerfilePathError.value = t('epinio.applications.steps.source.dockerfilePath.error.chars');
  }

  return dockerfilePathError.value || '';
}

const builderImageLabel = computed(() => props.buildOptions.builderImagesForbidden
  ? t('epinio.applications.steps.source.archive.builderimage.clusterDefault')
  : t('epinio.applications.steps.source.archive.builderimage.inputLabel'));

const showBuilderImage = computed(() =>
  [
    APPLICATION_SOURCE_TYPE.ARCHIVE,
    APPLICATION_SOURCE_TYPE.FOLDER,
    APPLICATION_SOURCE_TYPE.GIT_URL,
    APPLICATION_SOURCE_TYPE.GIT_HUB,
    APPLICATION_SOURCE_TYPE.GIT_LAB,
  ].includes(props.sourceType) &&
  props.buildOptions.buildMode === APPLICATION_BUILD_MODE.BUILDPACK
);

const showBuildMode = computed(() =>
  [
    APPLICATION_SOURCE_TYPE.ARCHIVE,
    APPLICATION_SOURCE_TYPE.FOLDER,
    APPLICATION_SOURCE_TYPE.GIT_URL,
    APPLICATION_SOURCE_TYPE.GIT_HUB,
    APPLICATION_SOURCE_TYPE.GIT_LAB,
  ].includes(props.sourceType)
);

const showDockerfilePath = computed(() => showBuildMode.value && props.buildOptions.buildMode === APPLICATION_BUILD_MODE.DOCKERFILE);

const buildModes = [
  { label: t('epinio.applications.steps.source.buildMode.buildpack'), value: APPLICATION_BUILD_MODE.BUILDPACK },
  { label: t('epinio.applications.steps.source.buildMode.dockerfile'), value: APPLICATION_BUILD_MODE.DOCKERFILE },
];

function handleBuilderImageDropdownChange(value: string) {
  if (value === 'custom') {
    props.updateBuildOptions({ builderImage: '' });
  } else {
    props.updateBuildOptions({ builderImage: value });
  }
}

</script>

<template>
    <div>
      <div class="spacer source">
        <trailhand-dropdown
          style="width: 100%"
          :options="(appChartsData?.items || []).map((ac) => ({ value: ac.meta.name, label: `${ac.meta.name} (${ac.shortDescription})` }))"
          :value="buildOptions.appChart"
          label="Application Chart"
          placeholder="Select an application chart"
          :disabled="isEdit"
          required
          filterable
          @dropdown-change="(e: CustomEvent) => { updateBuildOptions({ appChart: e.detail.value }); }"
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
            :value="buildOptions.buildMode"
            required
            data-testid="epinio_app-source_build-mode"
            :label="t('epinio.applications.steps.source.buildMode.inputLabel')"
            @dropdown-change="(e: CustomEvent) => { updateBuildOptions({ buildMode: e.detail.value }); }"
          />
        </div>
      </template>

      <template v-if="showDockerfilePath">
        <div class="spacer source">
          <h4>{{ t('epinio.applications.steps.source.dockerfilePath.label') }}</h4>
          <trailhand-text-input
            style="width: 100%;"
            :value="buildOptions.dockerfilePath"
            data-testid="epinio_app-source_dockerfile-path"
            :label="t('epinio.applications.steps.source.dockerfilePath.inputLabel')"
            :required="true"
            @text-input-change="(e: CustomEvent) => { validateDockerfilePathValue(e.detail.value); updateBuildOptions({ dockerfilePath: e.detail.value }); }"
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
            v-if="!buildOptions.builderImagesForbidden"
            style="width: 100%"
            :options="allBuilderImages"
            :value="selectedBuilderImage"
            label="Builder Image"
            placeholder="Select a builder image"
            :disabled="isEdit"
            required
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
            :value="buildOptions.builderImage"
            data-testid="epinio_app-source_builder-value"
            :label="builderImageLabel"
            :placeholder="defaultBuilderImageForPlaceholder"
            :disabled="!isCustomBuilderImage"
            @text-input-change="(e: CustomEvent) => { updateBuildOptions({ builderImage: e.detail.value }); }"
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
