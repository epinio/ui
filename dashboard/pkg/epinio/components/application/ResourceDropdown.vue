<script setup lang="ts">
import { ref } from 'vue';
import { debounce } from 'lodash';

const props = defineProps<{
    value?: string;
    values?: string[];
    options: {label: string, value: string }[];
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    label?: string;
    onDropdownChange: (e: CustomEvent) => void;
    fetchAllResources: () => Promise<void>;
    searchResources: (query: string) => Promise<void>;
    isLoading?: boolean;
    multiselect?: boolean;
}>();

const debounceTime = ref<number>(1000);

// Monotonic token identifying the most recent resource search/restore. A
// search response only applies if its token is still current, so a request
// that resolves after the user cleared (or started a newer search) is dropped
// instead of overwriting the list. `.cancel()` alone can't do this: it only
// stops a debounced call that hasn't fired yet, not a request already in flight.
let resourceSearchSeq = 0;

async function wrapSearchResources(query: string) {
  const seq = ++resourceSearchSeq;
  if (seq !== resourceSearchSeq) {
      return;
  }

  try {
    await props.searchResources(query);
  } catch {
    console.error('Error searching resources');
  }
}

const debouncedSearchResources = debounce(wrapSearchResources, debounceTime.value);

// Restore the initial resource list when the search is cleared. Bumping the
// token invalidates any search response still in flight; cancelling drops any
// debounced search not yet fired. Both are needed to avoid the cleared list
// being overwritten by a late response.
function restoreResources() {
  resourceSearchSeq++;
  debouncedSearchResources.cancel();
  props.fetchAllResources();
}

// Route filter events: an empty query means the search was cleared.
function onResourceFilter(query: string) {
  if (!query.length) {
    restoreResources();
    return;
  }

  debouncedSearchResources(query);
}

// The dropdown doesn't emit events for two gestures we care about: opening the
// panel (the `trigger`) and clearing the search box (the `search-clear-btn`).
// Without handling them the dropdown keeps showing the last /namespacematches
// subset, so a reopen shows stale results plus the selected item instead of the
// full list.
function onDropdownClick(e: MouseEvent) {
  const { fetchAllResources } = props;
  const restoreOn = ['trigger', 'search-clear-btn'];

  const shouldRestore = e.composedPath().some(
    (el) => el instanceof HTMLElement &&
      restoreOn.some((cls) => el.classList.contains(cls))
  );

  if (shouldRestore) {
    fetchAllResources();
  }
}
</script>

<template>
    <trailhand-dropdown
        :value="value"
        :values="values"
        :options="options"
        :label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        data-testid="epinio_app-resource-dropdown"
        :required="required"
        filterable
        :loading="isLoading"
        :multiselect="multiselect"
        style="width: 100%;"
        @dropdown-change="(e: CustomEvent) => onDropdownChange(e)"
        @dropdown-filter="(e: CustomEvent<{ filter: string }>) => { onResourceFilter(e.detail.filter); }"
        @click="onDropdownClick"
    />
</template>
