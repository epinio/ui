<script lang="ts" setup>
import { ref, computed, reactive, watch, inject } from 'vue';
import { useStore } from 'vuex';
import { makeCommitShaCell, makeCommitAuthorCell } from '../../utils/table-formatters';
import debounce from 'lodash/debounce';
import { isArray } from '@shell/utils/array';
import { GitUtils, Commit } from '@shell/utils/git';
import { EPINIO_TYPES } from '../../types';

const props = defineProps<{
  value?: any;
  type: string;
}>();

const emit = defineEmits(['change']);

const store = useStore();
const t = store.getters['i18n/t'];

const debounceTime = inject<number>('debounceTime', 1000);
// State
const hasError = reactive({ acc: false, repo: false, branch: false, commits: false });
const repos = ref<object[]>([]);
const branches = ref<object[]>([]);
const commits = ref<any[]>([]);
const selectedAccOrOrg = ref<string | null>(props.value?.selectedAccOrOrg || null);
const selectedRepo = ref<object | null>(props.value?.selectedRepo || null);
const selectedRepoName = computed(() => selectedRepo.value?.name);
const selectedBranch = ref<object | null>(props.value?.selectedBranch || null);
const selectedBranchName = computed(() => selectedBranch.value?.name);
const selectedCommit = ref<Commit | null>(props.value?.selectedCommit || null);
const gitconfig = ref<string | null>(props.value?.gitconfig || null);

const gitUserType = ref<string | null>(null);

// Computed
const preparedRepos = computed(() =>
  normalizeArray(repos.value, (item: any) => ({ value: item.name, label: item.name }))
);

const preparedBranches = computed(() =>
  normalizeArray(branches.value, (item: any) => ({ value: item.name, label: item.name }))
);

const preparedCommits = computed<Commit[]>(() =>
  normalizeArray(commits.value, (c: any) => GitUtils[props.type].normalize.commit(c))
);

const selectedCommitId = computed(() => selectedCommit.value?.commitId);

const gitConfigs = computed(() => store.getters['epinio/all'](EPINIO_TYPES.GIT_CONFIG) || []);

// Columns for trailhand-table
const columns = computed(() => [
  {
    field: 'commitId',
    label: t(`gitPicker.${ props.type }.tableHeaders.choose.label`),
    width: '60px',
    sortable: false,
    formatter: (_v: any, row: any) => {
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
    label: t(`gitPicker.${ props.type }.tableHeaders.sha.label`),
    width: '90px',
    sortable: false,
    formatter: (_v: any, row: any) => makeCommitShaCell(row)
  },
  {
    field: 'author',
    label: t(`gitPicker.${ props.type }.tableHeaders.author.label`),
    width: '190px',
    sortable: false,
    formatter: (_v: any, row: any) => makeCommitAuthorCell(
      row,
      t(`gitPicker.${ props.type }.tableHeaders.author.unknown`)
    )
  },
  {
    field: 'message',
    label: t(`gitPicker.${ props.type }.tableHeaders.message.label`),
    sortable: false,
  },
  {
    field: 'date',
    label: t(`gitPicker.${ props.type }.tableHeaders.date.label`),
    width: '220px',
    sortable: false,
    formatter: (_v: any, row: any) => {
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

  return [...preparedCommits.value];
});

// Watch the gitconfig, reset on change, and fetch repos if type is gitlab
watch(() => gitconfig.value, async(neu, old) => {
  if (neu === old) return;
  reset();
  if (props.type === 'gitlab' && neu) {
    await fetchRepos('', neu);
  }
});

// Watch the account/org and perform a debounced search when it changes
watch(() => selectedAccOrOrg.value, async(neu, old) => {
  if (neu === old || !neu) return;
  debouncedFetchRepos(neu, gitconfig.value);
});

// Watch the repo and fetch branches when it changes
watch(() => selectedRepo.value, async(neu, old) => {
  if (neu === old) return;
  await fetchBranches();
});

// Watch the branch and fetch commits when it changes
watch(() => selectedBranch.value, async(neu, old) => {
  if (neu === old) return;
  await fetchCommits();
});

// Methods
function normalizeArray(elem: any, normalize: (v: any) => object): any[] {
  const arr = isArray(elem) ? elem : [elem];

  return arr.map((item: any) => normalize(item));
}

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
  repos.value = [];
  selectedAccOrOrg.value = null;
  selectedRepo.value = null;
  selectedBranch.value = null;
  selectedCommit.value = null;
  gitUserType.value = null;
  communicateReset();
}

function final(commitId: string) {
  selectedCommit.value = preparedCommits.value.find((c: any) => c.commitId === commitId) || null;

  if (selectedAccOrOrg.value && selectedRepo.value && selectedCommit.value?.commitId) {
    emit('change', {
      selectedAccOrOrg: selectedAccOrOrg.value,
      repo:             selectedRepo.value,
      branch:           selectedBranch.value,
      commit:           selectedCommit.value.commitId,
      sourceData:       {
        repos:    repos.value,
        branches: branches.value,
        commits:  commits.value,
      },
      gitconfig: gitconfig.value
    });
  }
}

async function getGithubUserType(username: string, gitconfig: string | null) {
  const payload = { url: `https://api.github.com/users/${username}` };
  if (gitconfig) {
    payload['gitconfig'] = gitconfig;
  }
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });

    const userType = res.data.type === 'User' ? 'user' : res.data.type === 'Organization' ? 'org' : null;
    gitUserType.value = userType;
    return userType;
  } catch (err) {
    console.error('Error fetching user type:', err);
    return null;
  }
}

async function getGitlabUserType(username: string, gitconfig: string | null) {
  // Try group first
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: { 
          url: `https://gitlab.com/api/v4/groups/${username}`,
          ...(gitconfig ? { gitconfig } : {})
        },
        responseType: 'json'
      }
    });
    if (res.data?.id) {
      gitUserType.value = 'group';
      return 'group';
    }
  } catch (err) {
    console.error('Error fetching GitLab group:', err);
  }

  // Fall back to user
  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: { 
          url: `https://gitlab.com/api/v4/users?username=${username}`,
          ...(gitconfig ? { gitconfig } : {})
        },
        responseType: 'json'
      }
    });
    if (res.data?.[0]?.id) {
      gitUserType.value = 'user';
      return 'user';
    }
  } catch (err) {
    console.error('Error fetching GitLab user:', err);
  }

  return null;
}

async function fetchRepos(username: string, gitconfig: string | null) {
  selectedRepo.value = null;
  selectedBranch.value = null;
  selectedCommit.value = null;
  communicateReset();

  const payload: any = {
    url: '',
  };
  if (gitconfig) {
    payload['gitconfig'] = gitconfig;
  }

  if (props.type === 'github') {
    const userType = await getGithubUserType(username, gitconfig);
    if (!userType) {
      hasError.acc = true;
      return;
    }

    payload.url = `https://api.github.com/search/repositories?q=${userType}:${username}`;
  } else {
    const userType = await getGitlabUserType(username, gitconfig);
    payload.url = `https://gitlab.com/api/v4/projects?${gitconfig ? 'membership=true&' : ''}simple=true${username ? `&search=${username}` : ''}`;
  }

  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });
    repos.value = props.type === 'github' ? res.data.items || [] : res.data || [];
    hasError.acc = false;
  } catch {
    hasError.acc = true;
  }

}

const debouncedFetchRepos = debounce(fetchRepos, debounceTime);

async function fetchBranches() {
  selectedBranch.value = null;
  selectedCommit.value = null;
  communicateReset();

  const payload = {
    url: '',
  }
  if (gitconfig.value) {
    payload['gitconfig'] = gitconfig.value;
  }

  if (props.type === 'github') {
    payload.url = `https://api.github.com/repos/${selectedAccOrOrg.value}/${selectedRepo.value?.name}/branches`;
  } else {
    payload.url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(selectedRepo.value?.id)}/repository/branches`;
  }

  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });

    branches.value = res.data || [];
    hasError.branch = false;
  } catch {
    hasError.branch = true;
  }
}

async function fetchCommits() {
  selectedCommit.value = null;
  communicateReset();

  const payload = {
    url: '',
  }
  if (gitconfig.value) {
    payload['gitconfig'] = gitconfig.value;
  }

  if (props.type === 'github') {
    payload.url = `https://api.github.com/repos/${selectedAccOrOrg.value}/${selectedRepo.value?.name}/commits?sha=${selectedBranch.value?.name}`;
  } else {
    payload.url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(selectedRepo.value?.id)}/repository/commits?ref_name=${selectedBranch.value?.name}`;
  }

  try {
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });

    commits.value = res.data || [];
    hasError.branch = false;
  } catch {
    hasError.commits = true;
  }
}

async function loadSourceCache(accOrOrg: string, repo: any, branch: any, commit: any) {
  selectedAccOrOrg.value = accOrOrg;

  if (selectedAccOrOrg.value || (props.type === 'gitlab' && gitconfig.value)) {
    await fetchRepos(selectedAccOrOrg.value, gitconfig.value)
      .then(() => {
        if (repos.value.length && !hasError.repo) {
          selectedRepo.value = repo;

          return fetchBranches();
        }
      })
      .then(() => {
        if (branches.value.length && !hasError.branch) {
          if (branch?.name) {
            selectedBranch.value = branch;

            return fetchCommits();
          }
        }
      });

    const foundCommit = commits.value?.find((c: any) => {
      const sha = c.sha || c.id;

      return sha === commit.sha;
    });

    if (foundCommit) {
      final(foundCommit.sha || foundCommit.id);
    }
  }
}

async function searchRepo(query: string) {
  if (query.length) {
    const payload: any = {
      url: '',
    }
    if (gitconfig.value) {
      payload['gitconfig'] = gitconfig.value;
    }

    if (props.type === 'github') {
      if (!gitUserType.value) {
        await getGithubUserType(selectedAccOrOrg.value, gitconfig.value);
      }
      payload.url = `https://api.github.com/search/repositories?q=${query}+${gitUserType.value}:${selectedAccOrOrg.value}`;
    } else {
      if (gitconfig.value) {
        payload.url = `https://gitlab.com/api/v4/projects?membership=true&simple=true&search=${query}`;
      } else {
        if (!gitUserType.value) {
          await getGitlabUserType(selectedAccOrOrg.value, gitconfig.value);
        }
        payload.url = `https://gitlab.com/api/v4/${gitconfig.value ? '' : `${gitUserType.value}s/${encodeURIComponent(selectedAccOrOrg.value)}/`}projects?${gitconfig.value ? 'membership=true&' : ''}simple=true&search=${query}`;
      }
    }

    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });

    const results = props.type === 'github' ? res.data.items || [] : res.data || [];

    if (!res.hasError) {
      repos.value = [ ...results];
    }
  } else {
    await fetchRepos(selectedAccOrOrg.value, gitconfig.value);
  }
}

const debouncedSearchRepo = debounce(searchRepo, debounceTime);

async function searchBranch(query: string) {
  if (props.type === 'github') {
    // github has no search branches endpoint, so we just fetch all branches and filter them client-side
    return;
  }
  if (query.length) {
    const payload: any = {
      url: '',
    }
    if (gitconfig.value) {
      payload['gitconfig'] = gitconfig.value;
    }
    payload.url = `https://gitlab.com/api/v4/projects/${selectedRepo.value?.id}/repository/branches?search=${query}`;
    const res = await store.dispatch('epinio/request', {
      opt: {
        url: '/api/v1/gitproxy',
        method: 'POST',
        data: payload,
        responseType: 'json'
      }
    });

    const results = res.data || [];

    if (!res.hasError) {
      branches.value = [...results];
    }
  } else {
    await fetchBranches();
  }
}

const debouncedSearchBranch = debounce(searchBranch, debounceTime);

watch(() => props.value, async(neu, old) => {
  if (JSON.stringify(neu) === JSON.stringify(old)) return;
  if (neu?.type !== old?.type) {
    reset();
    await loadSourceCache(neu.selectedAccOrOrg, neu.selectedRepo, neu.selectedBranch, neu.selectedCommit);
  }
}, { immediate: true, deep: true });
</script>

<template>
  <div class="picker">
    <div class="row">
      <div class="spacer source">
        <h3>Config</h3>
        <trailhand-dropdown
          style="width: 100%;"
          :value="gitconfig"
          :options="gitConfigs.map((c: any) => ({ value: c.metadata.name, label: c.metadata.name }))"
          data-testid="epinio_app-source_git-config"
          label="Config"
          @dropdown-change="(e: CustomEvent) => { gitconfig = e.detail.value }"
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
          :label="t(`gitPicker.${ type }.username.inputLabel`)"
          :required="true"
          @text-input-change="(e: CustomEvent) => { selectedAccOrOrg = e.detail.value; }"
        />
        <p v-if="hasError.acc" class="error-message">
          {{ t(`gitPicker.${ type }.errors.noAccount`) }}
        </p>
      </div>

      <div
        v-if="repos.length && !hasError.repo"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="selectedRepoName"
          data-testid="git_picker-repo"
          :label="t(`gitPicker.${ type }.repo.inputLabel`)"
          :required="true"
          :options="preparedRepos"
          filterable
          @dropdown-change="(e: CustomEvent) => { 
            const selected = repos.find((r: any) => r.name === e.detail.value);
            selectedRepo = selected || null; 
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { debouncedSearchRepo(e.detail.filter); }"
        />
      </div>

      <div
        v-if="selectedRepo"
        class="spacer"
      >
        <trailhand-dropdown
          style="width: 100%"
          :value="selectedBranchName"
          data-testid="git_picker-branch"
          :label="t(`gitPicker.${ type }.branch.inputLabel`)"
          :required="true"
          :options="preparedBranches"
          filterable
          @dropdown-change="(e: CustomEvent) => { 
            const selected = branches.find((b: any) => b.name === e.detail.value);
            if (selected) {
              selectedBranch = selected;
            } else {
              selectedBranch = null;
            }
          }"
          @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { debouncedSearchBranch(e.detail.filter); }"
        />
      </div>

      <div
        v-if="selectedBranch && preparedCommits.length"
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
