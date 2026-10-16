<script setup lang="ts">

import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import jsyaml from 'js-yaml';
import GitPicker from './GitPicker.vue';
import { generateZip } from '../../utils/download';
import {
  APPLICATION_SOURCE_TYPE,
} from '../../types';
import { useGitConfigs } from '../../queries/useGitConfigQueries';
import { ResourceQueryOptions, ListResourceRequestParams } from '../../models/resource/ui-types';
import debounce from 'lodash/debounce';
import { AppFormSource, App, AppManifest } from '../../models/application/ui-types';
import { ApiAppManifest } from '../../models/application/api-types';
import { toAppManifest } from '../../models/application/mappers';

interface FileWithRelativePath extends File {
  // For some reason TS throws this as missing at transpile time .. so recreate it
   readonly webkitRelativePath: string;
}

const store = useStore();

const t = store.getters['i18n/t'];

const props = defineProps<{
  source: AppFormSource;
  mode: string;
  updateSource: <K extends AppFormSource['type']>(type: K, newSource?: Partial<NonNullable<AppFormSource[K]>>) => void;
  populateFormFromApp: (app: App | AppManifest, setInitial?: boolean) => void;
}>();

const isEdit = computed(() => props.mode === 'edit');

const manifestFileInput = ref<HTMLInputElement | null>(null);
const archiveFileInput = ref<HTMLInputElement | null>(null);
const folderFileInput = ref<HTMLInputElement | null>(null);
const fileDialogActive = ref(false);
// Set when the config read is refused, which is a valid role, not a fault.
const gitConfigsForbidden = ref(false);

const gitConfigRequestParams = ref<ListResourceRequestParams>({
  page: 1,
  pageSize: 25,
  search: '',
});
const gitConfigRequestOptions = ref<ResourceQueryOptions>({
  enabled: true,
  polling: false,
});
const {data: gitConfigs, isLoading: isLoadingGitConfigs, isError: isErrorGitConfigs, error: gitConfigsError} = useGitConfigs(store, gitConfigRequestParams, gitConfigRequestOptions);
const onGitConfigFilter = debounce((query: string) => {
  gitConfigRequestParams.value.page = 1;
  gitConfigRequestParams.value.search = query;
}, 500);

// Derived and Computed
const types = Object.values(APPLICATION_SOURCE_TYPE).map(value => ({
  label: t(`epinio.applications.steps.source.${ value }.label`),
  value
}));

const validGitUrl = computed(() => {
  if (!props.source.gitUrl?.url) return false;

  const gitRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,})/gm;
  const result = gitRegex.exec(props.source.gitUrl?.url || '');

  return !!result && props.source.gitUrl?.url === result[0];
});

function onFileSelected(file: File) {
  props.updateSource(props.source.type, { tarball: file, name: file.name });
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

async function handleManifestFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const content = await file.text();
    onManifestFileSelected(content);
    input.value = ''; // Clear the input so the same file can be selected again if needed
  }
}

function onManifestFileSelected(file: string) {
  try {
    const parsed: ApiAppManifest = jsyaml.load(file);
    const manifest: AppManifest = toAppManifest(parsed);
    if (!parsed) throw new Error('Parsed manifest is empty');
    props.populateFormFromApp(manifest, false);
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
    props.updateSource(props.source.type, { tarball: zip, name: folderName || 'folder' });
  });
}

</script>

<template>
  <div class="appSource">
    <div class="button-row source">
      <trailhand-dropdown
        style="flex: 1"
        :options="types"
        :value="source.type"
        label="Source Type"
        :required="true"
        placeholder="Select a source type"
        data-testid="epinio_app-source_type"
        @dropdown-change="(e: CustomEvent) => updateSource(e.detail.value)"
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

    <template v-if="source.type === APPLICATION_SOURCE_TYPE.ARCHIVE">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.archive.file.label') }}</h3>
        <div class="button-row">
          <trailhand-text-input
            style="flex: 1"
            :value="source.archive?.name || ''"
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

    <template v-else-if="source.type === APPLICATION_SOURCE_TYPE.FOLDER">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.folder.file.label') }}</h3>
        <div class="button-row">
          <trailhand-text-input
            style="flex: 1"
            :value="source.folder?.name || ''"
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

    <template v-else-if="source.type === APPLICATION_SOURCE_TYPE.CONTAINER_URL">
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.containerUrl.url.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="source.containerUrl?.url || ''"
          data-testid="epinio_app-source_container"
          :label="t('epinio.applications.steps.source.containerUrl.url.inputLabel')"
          :required="true"
          @text-input-change="(e: CustomEvent) => { updateSource(source.type, { url: e.detail.value }); }"
        />
      </div>
    </template>

    <template v-else-if="source.type === APPLICATION_SOURCE_TYPE.GIT_URL">
      <div
        v-if="!gitConfigsForbidden"
        class="spacer source"
      >
        <h3>Git Config</h3>
        <trailhand-dropdown
          style="width: 100%"
          :value="source.gitUrl?.gitConfig"
          :options="(gitConfigs?.items || []).map((c: any) => ({ value: c.meta.name, label: c.meta.name }))"
          label="Git Config"
          :disabled="isEdit"
          @dropdown-change="(e: CustomEvent) => { updateSource(source.type, { gitConfig: e.detail.value }); }"
          filterable
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onGitConfigFilter(e.detail.filter); }"
          :loading="isLoadingGitConfigs"
        />
        <p v-if="isErrorGitConfigs" class="error-message">
          {{ t(`epinio.gitConfigs.errors.fetchAll`) }}
        </p>
      </div>
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.gitUrl.url.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="source.gitUrl?.url"
          data-testid="epinio_app-source_git-url"
          :label="t('epinio.applications.steps.source.gitUrl.url.inputLabel')"
          :placeholder="'https://github.com/{user or org}/{repository}'"
          :required="true"
          @text-input-change="(e: CustomEvent) => { updateSource(source.type, { url: e.detail.value, branch: '' }); }"
        />
        <p v-if="source.gitUrl?.url && !validGitUrl" class="error-message">
          {{ t('epinio.applications.steps.source.gitUrl.error.label') }}
        </p>
      </div>
      <div class="spacer source">
        <h3>{{ t('epinio.applications.steps.source.gitUrl.branch.label') }}</h3>
        <trailhand-text-input
          style="width: 100%;"
          :value="source.gitUrl?.branch"
          data-testid="epinio_app-source_git-branch"
          :label="t('epinio.applications.steps.source.gitUrl.branch.inputLabel')"
          :required="true"
          :disabled="!validGitUrl"
          @text-input-change="(e: CustomEvent) => { updateSource(source.type, { branch: e.detail.value }); }"
        />
      </div>
    </template>

    <template v-else>
      <GitPicker
        :gitSource="source[source.type] as AppFormSource['github'] | AppFormSource['gitlab']"
        :type="source.type as 'github' | 'gitlab'"
        :gitConfigs="gitConfigs?.items || []"
        :gitConfigsForbidden="gitConfigsForbidden"
        :onGitConfigFilter="onGitConfigFilter"
        :isLoadingGitConfigs="isLoadingGitConfigs"
        :isErrorGitConfigs="isErrorGitConfigs"
        :updateSource="updateSource"
      />
    </template>
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
.error-message {
  color: var(--error);
  font-size: 0.9em;
  margin-top: 4px;
}
</style>
