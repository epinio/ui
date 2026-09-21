<script lang="ts" setup>
import { ref, computed, reactive, watch, Ref } from 'vue';
import { useStore } from 'vuex';
import { makeCommitShaCell, makeCommitAuthorCell } from '../../utils/table-formatters';
import debounce from 'lodash/debounce';
import ResourceDropdown from './ResourceDropdown.vue';
import { useGitBaseUrl, useGitProxyUserType, useGitProxyRepos, useGitProxyBranches, useGitProxyCommits } from '../../queries/useGitProxyQueries';
import { GitProxyGitRepo, GitProxyGitBranch, GitProxyGitCommit } from '../../models/gitproxy/ui-types';
import { ResourceQueryOptions } from '../../models/resource/ui-types';
import { GitConfig } from '../../models/gitconfig/ui-types';


const props = defineProps<{
  value?: any;
  type: string;
  gitConfigs: GitConfig[];
  gitConfigsForbidden?: boolean;
  onGitConfigFilter: (query: string) => void;
  isLoadingGitConfigs: boolean;
}>();

const emit = defineEmits(['change']);

const store = useStore();
const t = store.getters['i18n/t'];

// State
const hasError = reactive({ acc: false, repo: false, branch: false, commits: false });
const selectedAccOrOrg = ref<string | null>(props.value?.selectedAccOrOrg || null);
const selectedRepo = ref<GitProxyGitRepo | null>(props.value?.selectedRepo || null);
const selectedRepoName = computed(() => selectedRepo.value?.name);
const selectedBranch = ref<GitProxyGitBranch | null>(props.value?.selectedBranch || null);
const selectedBranchName = computed(() => selectedBranch.value?.name);
const selectedCommit = ref<GitProxyGitCommit | null>(props.value?.selectedCommit || null);
const gitconfig = ref<string | null>(props.value?.gitconfig || null);
const gitType = computed(() => props.type as 'github' | 'gitlab');

// Computed
const preparedRepos = computed(() =>
  (gitRepos.value || []).map((item) => ({ value: item.name, label: item.name }))
);

const preparedBranches = computed(() =>
  (gitBranches.value || []).map((item) => ({ value: item.name, label: item.name }))
);

const selectedCommitId = computed(() => selectedCommit.value?.commitId);

const gitConfigs = computed(() => (props.gitConfigs || []).filter((c: any) => c.provider.includes(props.type)));

const selectedGitConfig = computed(() => gitConfigs.value.find((c: any) => c.meta.name === gitconfig.value) || null);

const gitBaseUrl = useGitBaseUrl(gitType, selectedGitConfig); 

watch(gitType, (newVal, oldVal) => {
  reset();
});

const debouncedGitUserSearch = ref<string>('');
watch(selectedAccOrOrg, (newQuery) => {
    onSearch(newQuery || '');
});
const onSearch = debounce(async (query: string) => {
  debouncedGitUserSearch.value = query;
}, 500);
const gitUserRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && debouncedGitUserSearch.value !== '',
  polling: false,
}));

const { data: gitUser, isLoading: isGitUserLoading, isError: isGitUserError, error: gitUserError } = useGitProxyUserType(
  store,
  gitType,
  debouncedGitUserSearch,
  gitconfig,
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
  enabled: gitBaseUrl.value !== null && !!gitUser.value,
  polling: false,
}));

const { data: gitRepos, isLoading: isGitReposLoading, isError: isGitReposError, error: gitReposError } = useGitProxyRepos(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitconfig,
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

const { data: gitBranches, isLoading: isGitBranchesLoading, isError: isGitBranchesError, error: gitBranchesError } = useGitProxyBranches(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitconfig,
  gitBaseUrl as Ref<string>,
  selectedRepo as Ref<GitProxyGitRepo>,
  debouncedGitBranchSearch,
  gitBranchRequestOptions,
);

const gitCommitRequestOptions = computed<ResourceQueryOptions>(() => ({
  enabled: gitBaseUrl.value !== null && !!gitUser.value && !!selectedRepo.value && !!selectedBranch.value,
  polling: false,
}));

const { data: gitCommits, isLoading: isGitCommitsLoading, isError: isGitCommitsError, error: gitCommitsError } = useGitProxyCommits(
  store,
  gitType,
  gitUser as Ref<{ username: string, userType: string | null }>,
  gitconfig,
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
      input.addEventListener('change', () => final(row.commitId));

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
  console.log('gitCommits.value:', gitCommits.value);
  return [...gitCommits.value];
});

function communicateReset() {
  emit('change', {
    selectedAccOrOrg: selectedAccOrOrg.value,
    repo:             selectedRepo.value,
    branch:           selectedBranch.value,
    commit:           selectedCommit.value,
    gitconfig:        gitconfig.value
  });
}

function reset() {
  selectedAccOrOrg.value = null;
  debouncedGitUserSearch.value = '';
  selectedRepo.value = null;
  selectedBranch.value = null;
  selectedCommit.value = null;
  // gitUser.value = null;
  communicateReset();
}

function final(commitId: string) {
  if (!gitCommits.value) return;
  selectedCommit.value = gitCommits.value.find((c) => c.commitId === commitId) || null;

  if (selectedRepo.value && selectedCommit.value?.commitId) {
    emit('change', {
      // Always pass the account/org through, even though it is no longer
      // required to emit: GitHub needs it downstream, GitLab+gitconfig leaves
      // it null (the membership flow has no account/org).
      selectedAccOrOrg: selectedAccOrOrg.value,
      repo:             selectedRepo.value,
      branch:           selectedBranch.value,
      commit:           selectedCommit.value.commitId,
      sourceData:       {
        repos:    gitRepos.value,
        branches: gitBranches.value,
        commits:  gitCommits.value,
      },
      gitconfig: gitconfig.value
    });
  }
}

watch(() => props.value, async(neu, old) => {
  if (JSON.stringify(neu) === JSON.stringify(old)) return;
  if (neu?.type !== old?.type) {
    reset();
    // await loadSourceCache(neu.selectedAccOrOrg, neu.selectedRepo, neu.selectedBranch, neu.selectedCommit);
  }
}, { immediate: true, deep: true });
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
          :value="gitconfig"
          :options="(gitConfigs || []).map((c: any) => ({ value: c.meta.name, label: c.meta.name }))"
          label="Git Config"
          @dropdown-change="(e: CustomEvent) => { gitconfig = e.detail.value; }"
          filterable
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onGitConfigFilter(e.detail.filter); }"
          :loading="isLoadingGitConfigs"
        />
      </div>

      <div
        v-if="type === 'github' || (type === 'gitlab' && !gitconfig)"
        class="spacer"
      >
        <trailhand-text-input
          style="width: 100%"
          :value="selectedAccOrOrg"
          data-testid="git_picker-username-or-org"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.username.label`)"
          :required="true"
          @text-input-change="(e: CustomEvent) => { selectedAccOrOrg = e.detail.value; }"
        />
        <p v-if="hasError.acc" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noAccount`) }}
        </p>
      </div>

      <div
        v-if="selectedAccOrOrg || (type === 'gitlab' && gitconfig)"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="selectedRepoName"
          data-testid="git_picker-repo"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.repo.label`)"
          :required="true"
          :options="preparedRepos"
          filterable
          :loading="isGitReposLoading"
          @dropdown-change="(e: CustomEvent) => {
            if (!e.detail.value) {
              selectedRepo = null;
              return;
            }
            if (!gitRepos) {
              selectedRepo = null;
              return;
            }
            const selected = gitRepos.find((r) => r.name === e.detail.value);
            selectedRepo = selected || null;
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { repoQuery = e.detail.filter; }"
        />
        <p v-if="hasError.repo" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noRepo`) }}
        </p>
      </div>

      <div
        v-if="selectedRepo"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="selectedBranchName"
          data-testid="git_picker-branch"
          :label="t(`epinio.applications.gitSource.${ type }.inputs.branch.label`)"
          :required="true"
          :options="preparedBranches"
          filterable
          :loading="isGitBranchesLoading"
          @dropdown-change="(e: CustomEvent) => {
            if (!e.detail.value) {
              selectedBranch = null;
              return;
            }
            if (!gitBranches) {
              selectedBranch = null;
              return;
            }
            const selected = gitBranches.find((b) => b.name === e.detail.value);
            selectedBranch = selected || null;
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { branchQuery = e.detail.filter; }"
        />
        <p v-if="hasError.branch" class="error-message">
          {{ t(`epinio.applications.gitSource.${ type }.errors.noBranch`) }}
        </p>
      </div>

      <div
        v-if="isGitCommitsLoading"
        class="spacer"
      >
        <trailhand-loading-spinner />
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
