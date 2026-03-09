<script lang="ts" setup>
import { ref, computed, reactive, watch, inject } from 'vue';
import { useStore } from 'vuex';
import { makeCommitShaCell, makeCommitAuthorCell } from '../../utils/table-formatters';
import debounce from 'lodash/debounce';
import { isArray } from '@shell/utils/array';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { GitUtils, Commit } from '@shell/utils/git';

const props = defineProps<{
  value?: any;
  type: string;
}>();

const emit = defineEmits(['change']);

const store = useStore();
const t = store.getters['i18n/t'];

const debounceTime = inject<number>('debounceTime', 1000);

// State
const hasError = reactive({ repo: false, branch: false, commits: false });
const repos = ref<object[]>([]);
const branches = ref<object[]>([]);
const commits = ref<any[]>([]);
const selectedAccOrOrg = ref<string | undefined>(undefined);
const selectedRepo = ref<object | undefined>(undefined);
const selectedBranch = ref<object | undefined>(undefined);
const selectedCommit = ref<Commit | null>(null);

// Computed
const preparedRepos = computed(() =>
  normalizeArray(repos.value, (item: any) => ({ id: item.id, name: item.name }))
);

const preparedBranches = computed(() =>
  normalizeArray(branches.value, (item: any) => ({ id: item.id, name: item.name }))
);

const preparedCommits = computed<Commit[]>(() =>
  normalizeArray(commits.value, (c: any) => GitUtils[props.type].normalize.commit(c))
);

const selectedCommitId = computed(() => selectedCommit.value?.commitId);

// Columns for data-table
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

// Methods
function normalizeArray(elem: any, normalize: (v: any) => object): any[] {
  const arr = isArray(elem) ? elem : [elem];

  return arr.map((item: any) => normalize(item));
}

function communicateReset() {
  emit('change', {
    selectedAccOrOrg: selectedAccOrOrg.value,
    repo:             selectedRepo.value,
    commit:           selectedCommit.value,
  });
}

function reset() {
  repos.value = [];
  selectedAccOrOrg.value = undefined;
  selectedRepo.value = undefined;
  selectedBranch.value = undefined;
  selectedCommit.value = null;
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
      }
    });
  }
}

async function fetchRepos() {
  repos.value = [];
  selectedRepo.value = undefined;
  selectedBranch.value = undefined;
  selectedCommit.value = null;
  communicateReset();

  if (selectedAccOrOrg.value?.length) {
    try {
      const res = await store.dispatch(`${ props.type }/fetchRecentRepos`, { username: selectedAccOrOrg.value });

      repos.value = res;
      hasError.repo = false;
    } catch {
      hasError.repo = true;
    }
  }
}

async function fetchBranches() {
  selectedBranch.value = undefined;
  selectedCommit.value = null;
  communicateReset();

  try {
    const res = await store.dispatch(`${ props.type }/fetchBranches`, {
      repo:     selectedRepo.value,
      username: selectedAccOrOrg.value,
    });

    branches.value = res;
    hasError.branch = false;
  } catch {
    hasError.branch = true;
  }
}

async function fetchCommits() {
  selectedCommit.value = null;
  communicateReset();

  try {
    const res = await store.dispatch(`${ props.type }/fetchCommits`, {
      repo:     selectedRepo.value,
      username: selectedAccOrOrg.value,
      branch:   selectedBranch.value,
    });

    commits.value = res as any[];
    hasError.branch = false;
  } catch {
    hasError.commits = true;
  }
}

async function loadSourceCache(accOrOrg: string, repo: any, branch: any, commit: any) {
  selectedAccOrOrg.value = accOrOrg;

  if (selectedAccOrOrg.value) {
    await fetchRepos()
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
    const resultInCurrentState = repos.value.filter((r: any) => r.name.startsWith(query));

    if (!resultInCurrentState.length) {
      const res = await store.dispatch(`${ props.type }/search`, {
        repo:     { id: query, name: query },
        username: selectedAccOrOrg.value,
      });

      hasError.repo = !!res.hasError;

      if (!res.hasError && res.length >= 1) {
        repos.value = res;
      }
    } else {
      return resultInCurrentState;
    }
  }
}

async function searchBranch(query: string) {
  const res = await store.dispatch(`${ props.type }/search`, {
    repo:     selectedRepo.value,
    branch:   { name: query },
    username: selectedAccOrOrg.value,
  });

  hasError.branch = !!res.hasError;

  if (!hasError.branch) {
    branches.value = res;
  }
}

function debounceRequest(callback: (param: any) => Promise<any>, timeout = debounceTime) {
  return debounce(async(param: any) => await callback(param), timeout);
}

function searchForResult(callback: (query: string) => Promise<any>) {
  return debounceRequest(async(query: string) => {
    if (!query.length) return;

    return await callback(query);
  });
}

const onSearchRepo = searchForResult(searchRepo);
const onSearchBranch = searchForResult(searchBranch);

function reposRules() {
  return hasError.repo ? t(`gitPicker.${ props.type }.errors.noAccount`) : null;
}

function branchesRules() {
  return hasError.branch ? t(`gitPicker.${ props.type }.errors.noBranch`) : null;
}

function status(value: boolean): string | undefined {
  return value ? 'error' : undefined;
}

function selectReduction(e: unknown) {
  return e;
}

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
      <div class="spacer">
        <LabeledInput
          v-model:value="selectedAccOrOrg"
          data-testid="git_picker-username-or-org"
          :tooltip="t(`gitPicker.${ type }.username.tooltip`)"
          :label="t(`gitPicker.${ type }.username.inputLabel`)"
          :required="true"
          :rules="[reposRules]"
          :delay="debounceTime"
          :status="status(hasError.repo)"
          @update:value="fetchRepos"
        />
      </div>

      <div
        v-if="repos.length && !hasError.repo"
        class="spacer"
      >
        <LabeledSelect
          v-model:value="selectedRepo"
          :required="true"
          :label="t(`gitPicker.${ type }.repo.inputLabel`)"
          :options="preparedRepos"
          :clearable="true"
          :searchable="true"
          :reduce="selectReduction"
          :rules="[reposRules]"
          :status="status(hasError.repo)"
          :option-label="'name'"
          @search="onSearchRepo"
          @update:value="fetchBranches"
        />
      </div>

      <div
        v-if="selectedRepo"
        class="spacer"
      >
        <LabeledSelect
          v-model:value="selectedBranch"
          :required="true"
          :label="t(`gitPicker.${ type }.branch.inputLabel`)"
          :options="preparedBranches"
          :clearable="false"
          :reduce="selectReduction"
          :searchable="true"
          :rules="[branchesRules]"
          :status="status(hasError.branch)"
          :option-label="'name'"
          @search="onSearchBranch"
          @update:value="fetchCommits"
        />
      </div>

      <div
        v-if="selectedBranch && preparedCommits.length"
        class="commits-table mt-20"
      >
        <data-table
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

  .spacer {
    max-width: 700px;
  }

  .commits-table {
    margin: 0 1px;
    max-width: 1400px;

    data-table {
      --sortable-table-row-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-hover-bg: var(--sortable-table-hover-bg);
      --sortable-table-header-sorted-bg: var(--sortable-table-hover-bg);
    }
  }
}
</style>
