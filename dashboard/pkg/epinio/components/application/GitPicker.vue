<script lang="ts" setup>
import { ref, computed, watch, Ref } from 'vue';
import { useStore } from 'vuex';
import { makeCommitShaCell, makeCommitAuthorCell } from '../../utils/table-formatters';
import debounce from 'lodash/debounce';
import { useGitBaseUrl, useGitProxyUserType, useGitProxyRepos, useGitProxyBranches, useGitProxyCommits } from '../../queries/useGitProxyQueries';
import { GitProxyGitRepo, GitProxyGitBranch, GitProxyGitCommit } from '../../models/gitproxy/ui-types';
import { ResourceQueryOptions } from '../../models/resource/ui-types';
import { GitConfig } from '../../models/gitconfig/ui-types';
import { AppFormSource } from 'models/application/ui-types';
import { useGitConfig } from '../../queries/useGitConfigQueries';

const props = defineProps<{
  gitSource: AppFormSource['github'] | AppFormSource['gitlab'];
  type: 'github' | 'gitlab';
  updateSource: <K extends AppFormSource['type']>(type: K, newSource?: Partial<NonNullable<AppFormSource[K]>>) => void;
  gitConfigs: GitConfig[];
  gitConfigsForbidden?: boolean;
  onGitConfigFilter: (query: string) => void;
  isLoadingGitConfigs: boolean;
  isErrorGitConfigs: boolean;
}>();

const emit = defineEmits(['change']);

const store = useStore();
const t = store.getters['i18n/t'];

const gitType = computed(() => props.type as 'github' | 'gitlab');
const gitConfig = computed(() => props.gitSource?.gitConfig || null);

const selectedRepo = computed(() =>
  gitRepos.value?.find(
    repo => repo.name === props.gitSource?.repository
  ) ?? null
);

const selectedBranch = computed(() =>
  gitBranches.value?.find(
    branch => branch.name === props.gitSource?.branch
  ) ?? null
);

const selectedCommit = computed(() =>
  gitCommits.value?.find(
    commit => commit.commitId === props.gitSource?.commit
  ) ?? null
);

const gitConfigRequestOptions = ref<ResourceQueryOptions>({
  enabled: !!props.gitSource?.gitConfig,
  polling: false,
});
const {data: selectedGitConfig, isLoading: isLoadingGitConfig, isError: isErrorGitConfig, error: gitConfigError} = useGitConfig(store, props.gitSource?.gitConfig || '', gitConfigRequestOptions);


const preparedRepos = computed(() =>
  (gitRepos.value || []).map((item) => ({ value: item.name, label: item.name }))
);

const preparedBranches = computed(() =>
  (gitBranches.value || []).map((item) => ({ value: item.name, label: item.name }))
);

const selectedCommitId = computed(() => selectedCommit.value?.commitId);

const gitConfigs = computed(() => (props.gitConfigs || []).filter((c: any) => c.provider.includes(props.type)));

const gitBaseUrl = useGitBaseUrl(gitType, selectedGitConfig); 

const debouncedGitUserSearch = ref<string>(props.gitSource?.userOrOrg || '');
watch(
  () => props.gitSource?.userOrOrg,
  (newVal) => {
    onSearch(newVal || '');
  }
);
const onSearch = debounce(async (query: string) => {
  debouncedGitUserSearch.value = query;
}, 500);
const gitUserRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && debouncedGitUserSearch.value !== '',
  polling: false,
}));

const { data: gitUser, isLoading: isGitUserLoading, isError: isGitUserError } = useGitProxyUserType(
  store,
  gitType,
  debouncedGitUserSearch,
  gitConfig,
  gitBaseUrl as Ref<string>,
  gitUserRequestOptions,
);

const repoQuery = ref<string>('');
const debouncedGitRepoSearch = ref<string>('');
watch(repoQuery, (newQuery) => {
    onRepoSearch(newQuery || '');
});
const onRepoSearch = debounce(async (query: string) => {
  debouncedGitRepoSearch.value = query;
}, 500);
const gitRepoRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value?.username,
  polling: false,
}));

const { data: gitRepos, isLoading: isGitReposLoading, isError: isGitReposError } = useGitProxyRepos(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  debouncedGitRepoSearch,
  gitRepoRequestOptions,
);

const branchQuery = ref<string>('');
const debouncedGitBranchSearch = ref<string>('');
watch(branchQuery, (newQuery) => {
    onBranchSearch(newQuery || '');
});
const onBranchSearch = debounce(async (query: string) => {
  debouncedGitBranchSearch.value = query;
}, 500);
const gitBranchRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value && !!selectedRepo.value,
  polling: false,
}));

const { data: gitBranches, isLoading: isGitBranchesLoading, isError: isGitBranchesError } = useGitProxyBranches(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  selectedRepo as Ref<GitProxyGitRepo>,
  debouncedGitBranchSearch,
  gitBranchRequestOptions,
);

const gitCommitRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value && !!selectedRepo.value && !!selectedBranch.value,
  polling: false,
}));

const { data: gitCommits, isLoading: isGitCommitsLoading, isError: isGitCommitsError } = useGitProxyCommits(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitConfig,
  gitBaseUrl as Ref<string>,
  selectedRepo as Ref<GitProxyGitRepo>,
  selectedBranch as Ref<GitProxyGitBranch>,
  gitCommitRequestOptions,
);

// Columns for trailhand-table
const columns = computed(() => [
  {
    field: 'commitId',
    label: t(`epinio.applications.gitSource.${ props.type }.tableHeaders.choose.label`),
    width: '60px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => {
      const input = document.createElement('input') as HTMLInputElement;

      input.type = 'radio';
      input.name = 'commit-picker';
      input.value = row.commitId || '';
      input.checked = row.commitId === selectedCommitId.value;
      input.style.cursor = 'pointer';
      input.addEventListener('change', () => {console.log('commit changed:', row.commitId); props.updateSource(gitType.value, { commit: row.commitId })});

      return input;
    }
  },
  {
    field: 'sha',
    label: t(`epinio.applications.gitSource.${ props.type }.tableHeaders.sha.label`),
    width: '90px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => makeCommitShaCell(row)
  },
  {
    field: 'author',
    label: t(`epinio.applications.gitSource.${ props.type }.tableHeaders.author.label`),
    width: '190px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => makeCommitAuthorCell(
      row,
      t(`epinio.applications.gitSource.${ props.type }.tableHeaders.author.unknown`)
    )
  },
  {
    field: 'message',
    label: t(`epinio.applications.gitSource.${ props.type }.tableHeaders.message.label`),
    sortable: false,
  },
  {
    field: 'date',
    label: t(`epinio.applications.gitSource.${ props.type }.tableHeaders.date.label`),
    width: '220px',
    sortable: false,
    formatter: (_v: any, row: GitProxyGitCommit) => {
      const span = document.createElement('span');

      if (row.date) {
        span.textContent = new Date(row.date).toLocaleString();
      }

      return span;
    }
  },
]);

// Spread to create a new array reference when selectedCommitId changes,
// so Lit's hasChanged detects the update and re-renders the radio buttons.
const tableRows = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sid = selectedCommitId.value;

  if (!gitCommits.value) return [];
  return [...gitCommits.value];
});
</script>

<template>
  <div class="picker">
    <div class="row">
      <div
        v-if="!gitConfigsForbidden"
        class="spacer source"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="gitConfig"
          :options="(gitConfigs || []).map((c: any) => ({ value: c.meta.name, label: c.meta.name }))"
          label="Git Config"
          @dropdown-change="(e: CustomEvent) => { updateSource(gitType, { gitConfig: e.detail.value }); }"
          filterable
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onGitConfigFilter(e.detail.filter); }"
          :loading="isLoadingGitConfigs"
        />
        <p v-if="isErrorGitConfigs" class="error-message">
          {{ t(`epinio.gitConfigs.errors.fetchAll`) }}
        </p>
        <p v-if="isErrorGitConfig" class="error-message">
          {{ t(`epinio.gitConfigs.errors.fetchOne`) }}
        </p>
      </div>

      <div
        v-if="type === 'github' || (type === 'gitlab' && !gitConfig)"
        class="spacer"
      >
        <trailhand-text-input
          style="width: 100%"
          :value="gitSource?.userOrOrg || ''"
          data-testid="git_picker-username-or-org"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.username.label`)"
          :required="true"
          @text-input-change="(e: CustomEvent) => {
            updateSource(gitType, { userOrOrg: e.detail.value, repository: '', branch: '', commit: '' }); 
          }"
        />
        <p v-if="isGitUserError" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noAccount`) }}
        </p>
      </div>

      <div class="spacer" v-if="isGitUserLoading">
        <trailhand-loading-spinner />
      </div>

      <div
        v-if="gitUser || (type === 'gitlab' && gitConfig)"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="gitSource?.repository || ''"
          data-testid="git_picker-repo"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.repo.label`)"
          :required="true"
          :options="preparedRepos"
          filterable
          :loading="isGitReposLoading"
          @dropdown-change="(e: CustomEvent) => {
            updateSource(gitType, { repository: e.detail.value, branch: '', commit: '' });
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { repoQuery = e.detail.filter; }"
        />
        <p v-if="isGitReposError" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noRepo`) }}
        </p>
      </div>

      <div
        v-if="selectedRepo"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="gitSource?.branch || ''"
          data-testid="git_picker-branch"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.branch.label`)"
          :required="true"
          :options="preparedBranches"
          filterable
          :loading="isGitBranchesLoading"
          @dropdown-change="(e: CustomEvent) => {
            updateSource(gitType, { branch: e.detail.value, commit: '' });
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { branchQuery = e.detail.filter; }"
        />
        <p v-if="isGitBranchesError" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noBranch`) }}
        </p>
      </div>

      <div
        class="spacer"
      >
        <trailhand-loading-spinner v-if="isGitCommitsLoading"/>
        <p v-if="isGitCommitsError" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noCommits`) }}
        </p>
      </div>

      <div
        v-if="selectedBranch && gitCommits?.length"
        class="commits-table mt-20"
      >
        <trailhand-table
          :rows="tableRows"
          :columns="columns"
          key-field="sha"
          :searchable="true"
          :paginated="true"
          :rows-per-page="10"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.picker {
  .row {
    display: flex;
    flex-direction: column;
    margin: 6px 0;
  }

  img {
    height: 30px;
    margin-right: 1rem;

    .labeled-input {
      width: 100%;
    }
  }

  .commits-table {
    margin: 0 1px;
    max-width: 1400px;

    trailhand-table {
      --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
    }
  }
}

.error-message {
  color: var(--error);
  font-size: 0.9em;
  margin-top: 4px;
}
</style>
