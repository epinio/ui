<script setup lang="ts">

import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import jsyaml from 'js-yaml';

import Application from '../../models/applications';
import GitPicker from './GitPicker.vue';
import { sortBy } from '@shell/utils/sort';
import { generateZip } from '@shell/utils/download';
import {
  APPLICATION_SOURCE_TYPE,
  EpinioApplicationChartResource,
  EpinioInfo,
  EpinioAppSource,
  EPINIO_APP_MANIFEST
} from '../../types';
import { EpinioAppInfo } from '../../types';
import { _EDIT } from '@shell/config/query-params';
import { AppUtils } from '../../utils/application';
import { EPINIO_TYPES } from '../../types';
import ResourceDropdown from './ResourceDropdown.vue';

const GIT_BASE_URL = {
  [APPLICATION_SOURCE_TYPE.GIT_HUB]: 'https://github.com',
  [APPLICATION_SOURCE_TYPE.GIT_LAB]: 'https://gitlab.com',
};

interface FileWithRelativePath extends File {
  // For some reason TS throws this as missing at transpile time .. so recreate it
   readonly webkitRelativePath: string;
}

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{
  application: Application;
  source?: EpinioAppSource;
  info?: EpinioInfo;
  mode: string;
}>();

const emit = defineEmits<{
  (e: 'change', payload: any): void;
  (e: 'changeAppInfo', info: EpinioAppInfo): void;
  (e: 'changeAppConfig', configs: string[]): void;
  (e: 'valid', valid: boolean): void;
}>();

const isEdit = computed(() => props.mode === _EDIT);
const isView = computed(() => props.mode === 'view');

const manifestFileInput = ref<HTMLInputElement | null>(null);
const archiveFileInput = ref<HTMLInputElement | null>(null);
const folderFileInput = ref<HTMLInputElement | null>(null);
const fileDialogActive = ref(false);

const isLoadingGitConfigs = ref(false);
const gitConfigs = ref<any[]>([]);
const cachedGitConfigs = ref<any[]>([]);

const isLoadingAppCharts = ref(false);
const appCharts = ref<any[]>([]);
const cachedAppCharts = ref<any[]>([]);

const isLoadingBuilderImages = ref(false);
const builderImages = ref<any[]>([]);
const cachedBuilderImages = ref<any[]>([]);

const isFetchingChartsAndImages = ref<boolean>(true);

const builderImage = ref(props.source?.builderImage || '');

// Reactive State
const gitSkipTypeReset = ref(false);
const archive = reactive({
  tarball: props.source?.archive?.tarball || '',
  fileName: props.source?.type === 'folder' ? props.application?.origin?.path : props.source?.archive?.fileName || '',
});

const container = reactive({
  url: props.source?.container?.url || ''
});

const gitUrl = reactive({
  url: props.source?.gitUrl?.url || '',
  branch: props.source?.gitUrl?.branch || '',
  validGitUrl: props.source?.gitUrl?.url ? true : false,
  gitconfig: props.source?.gitUrl?.gitconfig || ''
});

const git = reactive({
  usernameOrOrg: props.source?.git?.usernameOrOrg || '',
  repo: props.source?.git?.repo || '',
  commit: props.source?.git?.commit || '',
  branch: props.source?.git?.branch || '',
  url: props.source?.git?.url || '',
  sourceData: props.source?.git?.sourceData || {
    repos: [],
    branches: [],
    commits: []
  },
  gitconfig: props.source?.git?.gitconfig || ''
});

const appChart = ref(props.application.configuration?.appchart || props.source?.appChart || '');
const type = ref(props.source?.type || APPLICATION_SOURCE_TYPE.FOLDER);

// Derived and Computed
const types = Object.values(APPLICATION_SOURCE_TYPE).map(value => ({
  label: t(`epinio.applications.steps.source.${ value }.label`),
  value
}));

const namespaces = computed(() => sortBy(store.getters['epinio/all'](EPINIO_TYPES.NAMESPACE), 'name', false));

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

const showBuilderImage = computed(() =>
  [APPLICATION_SOURCE_TYPE.ARCHIVE, APPLICATION_SOURCE_TYPE.FOLDER, APPLICATION_SOURCE_TYPE.GIT_URL, APPLICATION_SOURCE_TYPE.GIT_HUB, APPLICATION_SOURCE_TYPE.GIT_LAB].includes(type.value)
);

const gitSource = computed(() => ({
  type: type.value,
  selectedAccOrOrg: git.usernameOrOrg,
  selectedRepo: git.repo,
  selectedBranch: git.branch,
  selectedCommit: { sha: git.commit },
  gitconfig: git.gitconfig
}));

const valid = ref(validate());

const fetchGitConfigs = async () => {
  if (cachedGitConfigs.value.length > 0) {
    gitConfigs.value = cachedGitConfigs.value;
    return;
  }
  isLoadingGitConfigs.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitconfigs',
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.GIT_CONFIG, ...item })
    ));
    gitConfigs.value = classifiedData;
    cachedGitConfigs.value = classifiedData;
  } catch (error) {
    console.error('Failed to fetch git configs', error);
  } finally {
    isLoadingGitConfigs.value = false;
  }
};

async function searchGitConfigs(query: string) {
  isLoadingGitConfigs.value = true;
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: `/api/v1/gitconfigs?search=${query}`,
        method: 'GET',
        responseType: 'json'
      }
    });
    const rawData = res.data ?? [];
    const classifiedData = await Promise.all(rawData.map((item: any) =>
      store.dispatch('epinio/create', { type: EPINIO_TYPES.GIT_CONFIG, ...item })
    ));
    gitConfigs.value = classifiedData;
  } catch {
    gitConfigs.value = [];
  } finally {
    isLoadingGitConfigs.value = false;
  }
}

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
  } catch (error) {
    console.error('Failed to fetch builder images', error);
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
  } catch {
    builderImages.value = [];
  } finally {
    isLoadingBuilderImages.value = false;
  }
}

watch(type, () => {
  if (gitSkipTypeReset.value) {
    gitSkipTypeReset.value = false;
  } else {
    git.usernameOrOrg = '';
    git.repo = '';
    git.commit = '';
    git.branch = '';
    git.url = '';
    git.sourceData = {
      repos: [],
      branches: [],
      commits: []
    };
    git.gitconfig = '';
  }
  update();
});

// Immediate so the parent starts from the form's real validity instead of
// assuming the tab is valid until something changes.
watch(valid, (val) => {
  emit('valid', val);
}, { immediate: true });

function validate() {
  switch (type.value) {
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
    case APPLICATION_SOURCE_TYPE.FOLDER:
      // A deployed app keeps its uploaded source until a new one is picked, so
      // only a create needs files in hand.
      return (isEdit.value || !!archive.tarball) && !!builderImage.value;
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      return !!container.url;
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      return !!gitUrl.url && !!gitUrl.branch && !!builderImage.value && !!gitUrl.validGitUrl;
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      return !!git.usernameOrOrg && !!git.url && !!git.repo && !!git.branch && !!git.commit && !!builderImage.value;
  }
}

function update() {
  emit('change', {
    type: type.value,
    archive,
    container,
    gitUrl,
    builderImage: builderImage.value,
    appChart: appChart.value,
    git
  });
  valid.value = validate();
}

function updateAppInfo(info: EpinioAppInfo) {
  emit('changeAppInfo', info);
}

function updateConfigurations(configs: string[]) {
  emit('changeAppConfig', configs);
}

function handleBuilderImageDropdownChange(value: string) {
  if (value === 'custom') {
    builderImage.value = '';
  } else {
    builderImage.value = value;
  }
  update();
}

function gitUpdate({ repo, selectedAccOrOrg, branch, commit, sourceData, gitconfig }: any) {
  // GitHub always has an account/org selected; GitLab with a gitconfig lists
  // membership projects with no account/org, so only require it outside that case.
  const hasOwner = type.value === 'gitlab' || !!selectedAccOrOrg;
  if (hasOwner && !!repo && !!commit && !!branch) {
    git.usernameOrOrg = selectedAccOrOrg;
    // GitLab projects carry their own canonical URL (web_url), which is correct
    // for gitlab.com, enterprise instances, and the membership flow where no
    // account/org is picked. GitHub still builds from the selected org + repo.
    // Both providers return the repo's canonical URL on its own instance
    // (GitLab: web_url, GitHub: html_url), which is correct for SaaS and
    // enterprise alike. Fall back to building from the hardcoded base only if
    // that field is missing.
    git.url = type.value === 'gitlab'
      ? (repo.web_url || `${GIT_BASE_URL[type.value]}/${repo.path_with_namespace}`)
      : (repo.html_url || `${GIT_BASE_URL[type.value]}/${selectedAccOrOrg}/${repo.name}`);
    git.commit = commit;
    git.branch = branch;
    git.repo = repo;
    git.sourceData = sourceData;
    git.gitconfig = gitconfig;
    update();
    emit('valid', true);
  } else {
    update();
    emit('valid', false);
  }
}

function urlRule() {
  if (!gitUrl.url) return;

  const gitRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,})/gm;
  const result = gitRegex.exec(gitUrl.url);

  if (result && gitUrl.url === result[0]) {
    gitUrl.validGitUrl = true;
  } else {
    gitUrl.validGitUrl = false;
  }
}

function onFileSelected(file: File) {
  archive.tarball = file;
  archive.fileName = file.name;
  update();
}

function handleArchiveFileClick() {
  if (archiveFileInput.value) {
    fileDialogActive.value = true;
    archiveFileInput.value.click();
  }
}

function handleArchiveFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    onFileSelected(input.files[0]);
    input.value = ''; // Clear the input so the same file can be selected again if needed
  }
}

function handleFromManifestClick() {
  if (manifestFileInput.value) {
    fileDialogActive.value = true;
    manifestFileInput.value.click();
  }
}

function handleManifestFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    onManifestFileSelected(input.files[0] as any);
    input.value = ''; // Clear the input so the same file can be selected again if needed
  }
}

function onManifestFileSelected(file: string) {
  try {
    const parsed: any = jsyaml.load(file);
    const manifestType = AppUtils.getManifestSourceType(parsed.origin);
    gitSkipTypeReset.value = true;
    type.value = manifestType;

    switch (manifestType) {
      case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
        container.url = parsed.origin.container;
        break;
      case APPLICATION_SOURCE_TYPE.GIT_URL:
        gitUrl.url = parsed.origin.git.url;
        gitUrl.branch = parsed.origin.git.revision;
        break;
      case APPLICATION_SOURCE_TYPE.GIT_HUB:
      case APPLICATION_SOURCE_TYPE.GIT_LAB:
        Object.assign(git, AppUtils.getGitData(parsed.origin.git));
        break;
    }

    if (parsed.configuration) {
      appChart.value = parsed.configuration.appchart;
    }

    const appInfo: EpinioAppInfo = {
      meta: {
        name: parsed.name || '',
        namespace: namespaces.value?.[0]?.name || ''
      },
      configuration: {
        configurations: parsed.configuration?.configurations || [],
        instances: parsed.configuration.instances ?? 1,
        environment: parsed.configuration.environment || {},
        settings: parsed.configuration?.settings || {},
        routes: parsed.configuration.routes || []
      }
    };

    store.$router.replace({ query: { from: EPINIO_APP_MANIFEST } });
    update();
    updateAppInfo(appInfo);
    updateConfigurations(parsed.configuration.configurations || []);
  } catch (e) {
    console.error('Failed to parse manifest:', e);
  }
}

function handleFolderFileClick() {
  if (folderFileInput.value) {
    fileDialogActive.value = true;
    folderFileInput.value.click();
  }
}

function handleFolderFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    onFolderSelected(Array.from(input.files) as FileWithRelativePath[]);
    input.value = ''; // Clear the input so the same folder can be selected again if needed
  }
}

function onFolderSelected(files: FileWithRelativePath | FileWithRelativePath[]) {
  const safeFiles = Array.isArray(files) ? files : [files];
  let folderName = '';

  for (const f of safeFiles) {
    const paths = f.webkitRelativePath.split('/');
    if (paths.length > 1) {
      if (!folderName) {
        folderName = paths[0];
      } else if (folderName !== paths[0]) {
        folderName = '';
        break;
      }
    }
  }

  const filesToZip = safeFiles.reduce((res, f) => {
    let path = f.webkitRelativePath;
    if (folderName) {
      const parts = path.split('/');
      parts.shift();
      path = parts.join('/');
    }
    res[path] = f;
    return res;
  }, {} as { [key: string]: any });

  generateZip(filesToZip).then((zip: any) => {
    archive.tarball = zip;
    archive.fileName = folderName || 'folder';
    update();
  });
}

onMounted(async () => {
  await fetchAppCharts();
  await fetchBuilderImages();
  // If no app chart is set from the source or application configuration, default to the standard app chart
  if (!appChart.value) {
    const standardAppChart = appCharts.value.find((ac) => ac.meta.name === 'standard');
    appChart.value = props.application.configuration?.appchart || props.source?.appChart || standardAppChart?.meta.name || appCharts.value[0]?.meta.name || '';
  }
  // If no builder image is set from the source, default to the info default or the first in the catalog
  if (!builderImage.value) {
    const defaultImage = allBuilderImages.value.find((bi: any) => bi.default);
    builderImage.value = defaultImage ? defaultImage.value : allBuilderImages.value[0]?.value || '';
  }
  isFetchingChartsAndImages.value = false;
  update();
});

</script>

<template>
  <div class="appSource">
    <div class="button-row source">
      <trailhand-dropdown
        style="flex: 1"
        :options="types"
        :value="type"
        label="Source Type"
        :required="true"
        placeholder="Select a source type"
        data-testid="epinio_app-source_type"
        @dropdown-change="(e: CustomEvent) => type = e.detail.value"
      ></trailhand-dropdown>
      <trailhand-button
        variant="alternate"
        data-testid="epinio_app-source_manifest"
        @button-click="handleFromManifestClick"
      >
        From Manifest
      </trailhand-button>
      <input
        ref="manifestFileInput"
        type="file"
        class="hidden-file-input"
        @change="handleManifestFileChange"
        @cancel="fileDialogActive = false"
      >
    </div>

    <template v-if="type === APPLICATION_SOURCE_TYPE.ARCHIVE">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.archive.file.label') }}</h3>
        <div class="button-row">
          <trailhand-text-input
            style="flex: 1"
            :value="archive.fileName"
            data-testid="epinio_app-source_archive_name"
            :disabled="true"
            :label="t('epinio.applications.steps.source.archive.file.inputLabel')"
            :required="true"
          />
          <trailhand-button
            variant="alternate"
            data-testid="epinio_app-source_archive_file"
            @button-click="handleArchiveFileClick"
          >
            Select File
          </trailhand-button>
          <input
            ref="archiveFileInput"
            type="file"
            class="hidden-file-input"
            accept=".zip, .tar, .gz, .bz2, .xz"
            @change="handleArchiveFileChange"
            @cancel="fileDialogActive = false"
          >
        </div>
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.FOLDER">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.folder.file.label') }}</h3>
        <div class="button-row">
          <trailhand-text-input
            style="flex: 1"
            :value="archive.fileName"
            data-testid="epinio_app-source_folder_name"
            :disabled="true"
            :label="t('epinio.applications.steps.source.folder.file.inputLabel')"
            :required="true"
          />
          <trailhand-button
            variant="alternate"
            data-testid="epinio_app-source_folder_file"
            @button-click="handleFolderFileClick"
          >
            Select Folder
          </trailhand-button>
          <input
            ref="folderFileInput"
            type="file"
            webkitdirectory
            class="hidden-file-input"
            @change="handleFolderFileChange"
            @cancel="fileDialogActive = false"
          >
        </div>
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.CONTAINER_URL">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.container_url.url.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="container.url"
          data-testid="epinio_app-source_container"
          :label="t('epinio.applications.steps.source.container_url.url.inputLabel')"
          :required="true"
          @text-input-change="(e: CustomEvent) => { container.url = e.detail.value; update(); }"
        />
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.GIT_URL">
      <div class="spacer source">
        <h3>Git Config</h3>
        <ResourceDropdown
          :value="gitUrl.gitconfig"
          :options="gitConfigs.map((c: any) => ({ value: c.meta.name, label: c.meta.name }))"
          label="Git Config"
          :disabled="isEdit"
          :onDropdownChange="(e: CustomEvent) => { gitUrl.gitconfig = e.detail.value; update(); }"
          :fetchAllResources="fetchGitConfigs"
          :searchResources="searchGitConfigs"
          :isLoading="isLoadingGitConfigs"
        />
      </div>
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.git_url.url.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="gitUrl.url"
          data-testid="epinio_app-source_git-url"
          :label="t('epinio.applications.steps.source.git_url.url.inputLabel')"
          :placeholder="'https://github.com/{user or org}/{repository}'"
          :required="true"
          @text-input-change="(e: CustomEvent) => { gitUrl.url = e.detail.value; urlRule(); update(); }"
        />
        <p v-if="gitUrl.url && !gitUrl.validGitUrl" class="error">
          {{ t('epinio.applications.steps.source.git_url.error.label') }}
        </p>
      </div>
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.git_url.branch.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="gitUrl.branch"
          data-testid="epinio_app-source_git-branch"
          :label="t('epinio.applications.steps.source.git_url.branch.inputLabel')"
          :required="true"
          :disabled="!gitUrl.validGitUrl"
          @text-input-change="(e: CustomEvent) => { gitUrl.branch = e.detail.value; update(); }"
        />
      </div>
    </template>

    <template v-else>
      <GitPicker
        v-model:value="gitSource"
        :type="type"
        :gitConfigs="gitConfigs"
        :fetchGitConfigs="fetchGitConfigs"
        :searchGitConfigs="searchGitConfigs"
        :isLoadingGitConfigs="isLoadingGitConfigs"
        @change="gitUpdate"
      />
    </template>

    <div class="spacer source">
      <h3>Advanced Settings</h3>

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
          :disabled="isEdit || isView"
          placeholder="Select an application chart"
          :onDropdownChange="(e: CustomEvent) => { appChart = e.detail.value; update(); }"
          :fetchAllResources="fetchAppCharts"
          :searchResources="searchAppCharts"
          :isLoading="isLoadingAppCharts"
        />

        <template v-if="showBuilderImage">
          <div class="spacer source builder-image">
            <h4>Paketo Builder Image</h4>
            <ResourceDropdown
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
              :disabled="!isCustomBuilderImage"
              @text-input-change="(e: CustomEvent) => { builderImage = e.detail.value; update(); }"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.appSource {
  .button-row {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
  }

  .collapse {
    margin-left: -5px;
  }
}
.archive {
  display: flex;
  flex-direction: column;
}
.hidden-file-input {
  display: none;
}
.builder-image {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
