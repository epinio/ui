<script setup lang="ts">

import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import jsyaml from 'js-yaml';

import Application from '../../models/applications';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import FileSelector from '@shell/components/form/FileSelector.vue';
import GitPicker from '@shell/components/form/GitPicker.vue';
import RadioGroup from '@components/Form/Radio/RadioGroup.vue';
import { sortBy } from '@shell/utils/sort';
import { generateZip } from '@shell/utils/download';
import Collapse from '@shell/components/Collapse.vue';
import {
  APPLICATION_SOURCE_TYPE, 
  EpinioApplicationChartResource, 
  EpinioInfo, 
  //AppSourceArchive, 
  //AppSourceContainer, 
  //AppSourceGit, 
  //AppSourceGitUrl, 
  //AppSourceBuilderImage, 
  EpinioAppSource, 
  EPINIO_APP_MANIFEST
} from '../../types';
import { EpinioAppInfo } from '../../types';
import { _EDIT } from '@shell/config/query-params';
import { AppUtils } from '../../utils/application';

const GIT_BASE_URL = {
  [APPLICATION_SOURCE_TYPE.GIT_HUB]: 'https://github.com',
  [APPLICATION_SOURCE_TYPE.GIT_LAB]: 'https://gitlab.com',
};

/*interface Data {
  open: boolean,
  archive: AppSourceArchive,
  container: AppSourceContainer,
  git: AppSourceGit,
  gitUrl: AppSourceGitUrl,
  builderImage: AppSourceBuilderImage,
  types: any[],
  type: APPLICATION_SOURCE_TYPE ;// || { } from the select component
  APPLICATION_SOURCE_TYPE: typeof APPLICATION_SOURCE_TYPE
}*/

interface FileWithRelativePath extends File {
  // For some reason TS throws this as missing at transpile time .. so recreate it
   readonly webkitRelativePath: string;
}

// Todo: Ensure this uses the same default as the backend.
const DEFAULT_BUILD_PACK = 'paketobuildpacks/builder-jammy-full:latest';

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

// Defaults
const defaultBuilderImage = ref(props.info?.default_builder_image || DEFAULT_BUILD_PACK);
const builderImageValue = ref(props.source?.builderImage || defaultBuilderImage.value);

// console.log('props:', JSON.stringify(props)); 
console.log('//////////////////// AppSource props.application', props.application);
console.log('//////////////////// AppSource props.source:', (props.source));
console.log('//////////////////// AppSource props.source:', (props.source?.builderImage));
// console.log('props.source?.builderImage?.value :', props.source?.builderImage?.value);
// console.log('//////////////////// AppSource props.application.staging.builderImage:', props.application.staging.builder);
// console.log('Default Builder Image:', defaultBuilderImage.value);
// console.log('Builder Image Value:', builderImageValue.value);

// Reactive State
const open = ref(false);
const gitSkipTypeReset = ref(false);
const archive = reactive({
  tarball: props.source?.archive?.tarball || '',
  fileName: props.source?.archive?.fileName || '',
});

const container = reactive({
  url: props.source?.container?.url || ''
});

const gitUrl = reactive({
  url: props.source?.gitUrl?.url || '',
  branch: props.source?.gitUrl?.branch || '',
  validGitUrl: false,
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
  }
});

const builderImage = reactive({
  value: builderImageValue.value,
  default: builderImageValue.value === defaultBuilderImage.value
});

const EDIT = _EDIT;

const appChart = ref(props.source?.appChart);
const type = ref(props.source?.type || APPLICATION_SOURCE_TYPE.FOLDER);

// Derived and Computed
const types = Object.values(APPLICATION_SOURCE_TYPE).map(value => ({
  label: t(`epinio.applications.steps.source.${ value }.label`),
  value
}));

const namespaces = computed(() => sortBy(store.getters['epinio/all']('namespace'), 'name', false));
const appCharts = computed(() =>
  sortBy(store.getters['epinio/all']('appCharts'), 'name', false).map((ap: EpinioApplicationChartResource) => ({
    value: ap.meta.name,
    label: `${ap.meta.name} (${ap.short_description})`
  }))
);

const showBuilderImage = computed(() =>
  [APPLICATION_SOURCE_TYPE.ARCHIVE, APPLICATION_SOURCE_TYPE.FOLDER, APPLICATION_SOURCE_TYPE.GIT_URL, APPLICATION_SOURCE_TYPE.GIT_HUB, APPLICATION_SOURCE_TYPE.GIT_LAB].includes(type.value)
);

const gitSource = computed(() => ({
  type: type.value,
  selectedAccOrOrg: git.usernameOrOrg,
  selectedRepo: git.repo,
  selectedBranch: git.branch,
  selectedCommit: { sha: git.commit }
}));

const valid = ref(validate());

watch(type, () => {
  if (gitSkipTypeReset.value) {
    gitSkipTypeReset.value = false;
  } else {
    Object.assign(git, {});
  }
  update();
});

watch(valid, (val) => {
  emit('valid', val);
});

function validate() {
  switch (type.value) {
    case APPLICATION_SOURCE_TYPE.ARCHIVE:
    case APPLICATION_SOURCE_TYPE.FOLDER:
      return !!archive.tarball && !!builderImage.value;
    case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
      return !!container.url;
    case APPLICATION_SOURCE_TYPE.GIT_URL:
      return !!gitUrl.url && !!gitUrl.branch && !!builderImage.value && !!gitUrl.validGitUrl;
    case APPLICATION_SOURCE_TYPE.GIT_HUB:
    case APPLICATION_SOURCE_TYPE.GIT_LAB:
      return !!git.usernameOrOrg && !!git.url && !!git.repo && !!git.branch && !!git.commit;
  }
}

function update() {
  emit('change', {
    type: type.value,
    archive,
    container,
    gitUrl,
    builderImage,
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

function onImageType(defaultImage: boolean) {
  if (defaultImage) {
    builderImage.value = defaultBuilderImage.value;
  } else {
    builderImage.value = builderImageValue.value;
  }
  builderImage.default = defaultImage;
  update();
}

function gitUpdate({ repo, selectedAccOrOrg, branch, commit, sourceData }: any) {
  if (!!selectedAccOrOrg && !!repo && !!commit && !!branch) {
    git.usernameOrOrg = selectedAccOrOrg;
    git.url = `${GIT_BASE_URL[type.value]}/${selectedAccOrOrg}/${repo.name}`;
    git.commit = commit;
    git.branch = branch;
    git.repo = repo;
    git.sourceData = sourceData;
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
    return t('epinio.applications.steps.source.git_url.error.label');
  }
}

function onFileSelected(file: File) {
  archive.tarball = file;
  archive.fileName = file.name;
  update();
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
        instances: parsed.configuration.instances || 1,
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

onMounted(() => {
  if (!appChart.value) {
    appChart.value = appCharts.value[0]?.value || appCharts.value[0];
  }
  update();
});

</script>

<template>
  <div class="appSource">
    <div class="button-row source">
      <LabeledSelect
        v-model:value="type"
        data-testid="epinio_app-source_type"
        label="Source Type"
        :options="types"
        :mode="mode"
        :clearable="false"
      />
      <FileSelector
        v-clean-tooltip="t('epinio.applications.steps.source.manifest.tooltip')"
        data-testid="epinio_app-source_manifest"
        class="role-tertiary add mt-5"
        :label="t('epinio.applications.steps.source.manifest.button')"
        :mode="mode"
        :raw-data="false"
        @selected="onManifestFileSelected"
      />
    </div>

    <template v-if="type === APPLICATION_SOURCE_TYPE.ARCHIVE">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.archive.file.label') }}</h3>
        <div class="button-row">
          <LabeledInput
            v-model:value="archive.fileName"
            data-testid="epinio_app-source_archive_name"
            :disabled="true"
            :tooltip="t('epinio.applications.steps.source.archive.file.tooltip')"
            :label="t('epinio.applications.steps.source.archive.file.inputLabel')"
            :required="true"
          />
          <FileSelector
            data-testid="epinio_app-source_archive_file"
            class="role-tertiary add mt-5"
            :label="t('epinio.applications.steps.source.archive.file.button')"
            :mode="mode"
            :raw-data="true"
            :accept="'.zip, .tar, .gz, .bz2, .xz'"
            @selected="onFileSelected"
          />
        </div>
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.FOLDER">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.folder.file.label') }}</h3>
        <div class="button-row">
          <LabeledInput
            v-model:value="archive.fileName"
            data-testid="epinio_app-source_folder_name"
            :disabled="true"
            :tooltip="t('epinio.applications.steps.source.folder.file.tooltip')"
            :label="t('epinio.applications.steps.source.folder.file.inputLabel')"
            :required="true"
          />
          <FileSelector
            data-testid="epinio_app-source_folder_file"
            class="role-tertiary add mt-5"
            :label="t('epinio.applications.steps.source.folder.file.button')"
            :mode="mode"
            :raw-data="true"
            :directory="true"
            @selected="onFolderSelected"
          />
        </div>
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.CONTAINER_URL">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.container_url.url.label') }}</h3>
        <LabeledInput
          v-model:value="container.url"
          data-testid="epinio_app-source_container"
          :tooltip="t('epinio.applications.steps.source.container_url.url.tooltip')"
          :label="t('epinio.applications.steps.source.container_url.url.inputLabel')"
          :required="true"
          @input="update"
        />
      </div>
    </template>

    <template v-else-if="type === APPLICATION_SOURCE_TYPE.GIT_URL">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.git_url.url.label') }}</h3>
        <LabeledInput
          v-model:value="gitUrl.url"
          v-focus
          data-testid="epinio_app-source_git-url"
          :tooltip="t('epinio.applications.steps.source.git_url.url.tooltip')"
          :label="t('epinio.applications.steps.source.git_url.url.inputLabel')"
          :placeholder="'https://github.com/{user or org}/{repository}'"
          :required="true"
          :rules="[urlRule]"
          @delay="100"
          @input="update"
        />
      </div>
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.git_url.branch.label') }}</h3>
        <LabeledInput
          v-model:value="gitUrl.branch"
          data-testid="epinio_app-source_git-branch"
          :tooltip="t('epinio.applications.steps.source.git_url.branch.tooltip')"
          :label="t('epinio.applications.steps.source.git_url.branch.inputLabel')"
          :required="true"
          :disabled="!gitUrl.validGitUrl"
          @input="update"
        />
      </div>
    </template>

    <template v-else>
      <GitPicker
        v-model:value="gitSource"
        :type="type"
        @change="gitUpdate"
      />
    </template>

    <Collapse
      v-model:value:open="open"
      :title="'Advanced Settings'"
      class="pt-30 pb-30 source"
    >
      <LabeledSelect
        v-model:value="appChart"
        data-testid="epinio_app-source_appchart"
        :label="t('epinio.applications.steps.source.archive.appchart.label')"
        :options="appCharts"
        :mode="mode"
        :clearable="false"
        :required="true"
        :tooltip="t('typeDescription.appcharts')"
        :reduce="(e) => e.value"
        :disabled="mode === EDIT"
        @input="update"
      />

      <template v-if="showBuilderImage">
        <RadioGroup
          v-model:value="builderImage.default"
          class="mt-20"
          name="defaultBuilderImage"
          data-testid="epinio_app-source_builder-select"
          :labels="[
            t('epinio.applications.steps.source.archive.builderimage.default'),
            t('epinio.applications.steps.source.archive.builderimage.custom')
          ]"
          :options="[true, false]"
          :label-key="'epinio.applications.steps.source.archive.builderimage.label'"
          @update:value="onImageType"
        />
        <LabeledInput
          v-model:value="builderImage.value"
          data-testid="epinio_app-source_builder-value"
          :disabled="builderImage.default"
          :tooltip="t('epinio.applications.steps.source.archive.builderimage.tooltip')"
          :mode="mode"
          @input="update"
        />
      </template>
    </Collapse>
  </div>
</template>


<style lang="scss" scoped>
.appSource {
  // max-width: 920px;

  .source {
    max-width: 700px;
  }

  .button-row {
    display: flex;
    align-items: center;
    .file-selector {
      margin-top: 0 !important;
      margin-left: 5px;
    }
  }

  .collapse {
    margin-left: -5px;
  }
}
.archive {
  display: flex;
  flex-direction: column;
}
</style>
