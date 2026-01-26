<script setup lang="ts">
import { useStore } from 'vuex';
import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  nextTick,
  PropType,
} from 'vue';

import Socket, {
  EVENT_CONNECTED,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
  EVENT_CONNECT_ERROR
} from '@shell/utils/socket';
import day from 'dayjs';
import AnsiUp from 'ansi_up';
import { addParams } from '@shell/utils/url';
import { downloadFile } from '@shell/utils/download';
import { escapeHtml, escapeRegex } from '@shell/utils/string';
import { LOGS_TIME, LOGS_WRAP, DATE_FORMAT, TIME_FORMAT } from '@shell/store/prefs';

import Select from '@shell/components/form/Select';
import { Checkbox } from '@components/Form/Checkbox';
import AsyncButton from '@shell/components/AsyncButton';
import Window from '@shell/components/nav/WindowManager/Window';

import { useApplicationSocketMixin } from './ApplicationSocketMixin';

const store = useStore();
const t = store.getters['i18n/t'];

interface ContainerInfo {
  name: string;
  podName: string;
  isInitContainer: boolean;
}

const props = defineProps({
  application: {
    type: Object as PropType<object>,
    default: null,
  },
  endpoint: {
    type: String as PropType<string>,
    default: '',
  },
  ansiToHtml: {
    type: Boolean as PropType<boolean>,
    default: false,
  },
  initialInstance: {
    type:    String,
    default: null,
  },
});

const {
  socket,
  isOpen,
  backlog,
  instanceChoices,
  getRootSocketUrl,
} = useApplicationSocketMixin(props);

const lastId = ref<number>(1);
const search = ref<string>('');
const instance = ref<string>(props.initialInstance || instanceChoices[0]);
const lines = ref<Array<any>>([]);
const timerFlush = ref<object>(null);
const isFollowing = ref<boolean>(false);
const active = ref<boolean>(true);
const body = ref<HTMLElement>(null);
const isApplyingFilters = ref<boolean>(false);

// Time-based filter parameters
const tail = ref<number | null>(null); // Number of lines to show
const since = ref<string | null>(null); // Duration like "1h", "30m", "24h"
const sinceTime = ref<string | null>(null); // ISO datetime string from native input

// Container filtering state
const availableContainers = ref<ContainerInfo[]>([]);
const selectedContainers = ref<Set<string>>(new Set());
const excludedContainers = ref<Set<string>>(new Set());
const filterMode = ref<'include' | 'exclude'>('exclude');
const containerSearch = ref<string>('');
const loadingContainers = ref<boolean>(false);
const showAppLogs = ref<boolean>(true);

const ansiup = new AnsiUp();
const timestamps = store.getters['prefs/get'](LOGS_TIME);
const wrap = ref<boolean>(store.getters['prefs/get'](LOGS_WRAP));

onMounted(async () => {
  await fetchContainers();
  await connect();
  let boundUpdateFollowing = updateFollowing.bind(body);
  body.value.addEventListener('scroll', boundUpdateFollowing);
  timerFlush.value = setInterval(flush, 100);
});

onBeforeUnmount(() => {
  const el = document.querySelector('.logs-container') as HTMLElement;
  if (el) {
    el.removeEventListener('scroll', updateFollowing);
  }
  cleanup();
  isOpen.value = false;
});

const instanceChoicesWithNone = computed(() => {
  return [
    ...instanceChoices.value,
    {
      label: 'No Instance Filter',
      value: null
    }
  ];
});

// Compute active filter count
const activeFilterCount = computed(() => {
  if (filterMode.value === 'include') {
    return selectedContainers.value.size;
  } else {
    return excludedContainers.value.size;
  }
});

// Filter containers for the search
const filteredContainers = computed(() => {
  if (!containerSearch.value) {
    return availableContainers.value;
  }
  const searchLower = containerSearch.value.toLowerCase();
  return availableContainers.value.filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.podName.toLowerCase().includes(searchLower)
  );
});

const filtered = computed(() => {
  let filteredLines = lines.value;

  // Filter out excluded containers from existing logs
  if (excludedContainers.value.size > 0) {
    filteredLines = filteredLines.filter(line => {
      // Extract container name from log line format: [PodName] ContainerName Message
      const match = line.rawMsg.match(/\[[^\]]+\]\s+(\S+)\s+/);
      if (match && match[1]) {
        const containerName = match[1];
        return !excludedContainers.value.has(containerName);
      }
      return true; // Keep line if we can't parse container name
    });
  }

  // Filter out app logs if showAppLogs is false
  if (!showAppLogs.value) {
    filteredLines = filteredLines.filter(line => {
      // Extract container name from log line format: [PodName] ContainerName Message
      const match = line.rawMsg.match(/\[[^\]]+\]\s+(\S+)\s+/);
      if (match && match[1]) {
        const containerName = match[1];
        const isSidecarContainer = isSidecar(containerName);
        // Keep only sidecar logs when app logs are hidden
        return isSidecarContainer;
      }
      return true; // Keep line if we can't parse container name
    });
  }

  if (!search.value && !instance.value) {
    return filteredLines;
  }

  const re = new RegExp(escapeRegex(search.value), 'img');
  const out = [];

  for (const line of filteredLines) {
    let msg = line.rawMsg;

    if (instance.value) {
      const pod = msg.substring(1, msg.length);

      if (!pod.startsWith(instance.value)) {
        continue;
      }
    }

    const matches = msg.match(re);

    if (!matches) {
      continue;
    }

    const parts = msg.split(re);

    msg = '';
    while (parts.length || matches.length) {
      if (parts.length) {
        msg += ansiup.ansi_to_html(parts.shift()); // This also escapes
      }

      if (matches.length) {
        msg += `<span class="highlight">${ ansiup.ansi_to_html(matches.shift()) }</span>`;
      }
    }

    out.push({
      id:   line.id,
      time: line.time,
      msg,
    });
  }

  return out;
});

const timeFormatStr = computed(() => {
  const dateFormat = escapeHtml(store.getters['prefs/get'](DATE_FORMAT));
  const timeFormat = escapeHtml(store.getters['prefs/get'](TIME_FORMAT));

  return `${ dateFormat } ${ timeFormat }`;
});

const getSocketUrl = async () => {
  const { url, token } = await getRootSocketUrl();

  // Build params object with time-based filters
  const params: any = {
    follow: true,
    authtoken: token
  };

  // Add optional time-based filter parameters if they have values
  if (tail.value !== null && tail.value > 0) {
    params.tail = tail.value;
  }

  // Add time-based filters (since_seconds or since duration)
  if (sinceTime.value) {
    const selectedTime = new Date(sinceTime.value).getTime();
    const secondsAgo = Math.floor((Date.now() - selectedTime) / 1000);

    if (secondsAgo > 0) {
      params.since_seconds = secondsAgo;
    }
  } else if (since.value) {
    params.since = since.value; // Duration like "1h", "30m", "24h"
  }

  // Add container filter parameters
  if (filterMode.value === 'include' && selectedContainers.value.size > 0) {
    params.include_containers = Array.from(selectedContainers.value).join(',');
  }

  if (excludedContainers.value.size > 0) {
    params.exclude_containers = Array.from(excludedContainers.value).join(',');
  }

  return addParams(url, params);
};

const connect = async () => {
  console.log('Connecting to application logs socket...');
  // Disconnect existing socket and clear logs
  if (socket.value) {
    console.log('Disconnecting existing socket...');
    await socket.value.disconnect();
    socket.value = null;
  }
  backlog.value = [];
  lines.value = [];

  const url = await getSocketUrl();

  socket.value = new Socket(url, true, 0);
  socket.value.setAutoReconnectUrl(getSocketUrl);

  socket.value.addEventListener(EVENT_CONNECTED, () => {
    isOpen.value = true;
  });

  socket.value.addEventListener(EVENT_DISCONNECTED, () => {
    isOpen.value = false;
  });

  socket.value.addEventListener(EVENT_CONNECT_ERROR, (e: any) => {
    isOpen.value = false;
    console.error('WebSocket Connect Error', e);
  });

  socket.value.addEventListener(EVENT_MESSAGE, async (e: any) => {
    let parsedData;

    try {
      parsedData = JSON.parse(e.detail.data);
    } catch (e) {
      console.warn('Unable to parse websocket data: ', e);
      return;
    }

    const { PodName, ContainerName, Message, Timestamp } = parsedData;

    // Filter out excluded containers client-side as a safety measure
    if (ContainerName && excludedContainers.value.has(ContainerName)) {
      return; // Skip this log if container is excluded
    }

    // Filter out app logs if showAppLogs is false
    // App logs are from containers that are NOT sidecars
    if (!showAppLogs.value && ContainerName && !isSidecar(ContainerName)) {
      return; // Skip this log if it's an app log and app logs are hidden
    }

    // Extract container name from log data if not already discovered
    // This is especially important for staging logs where pods API may not be available
    if (ContainerName) {
      const existingContainer = availableContainers.value.find(c => c.name === ContainerName);
      if (!existingContainer) {
        availableContainers.value.push({
          name: ContainerName,
          podName: PodName || '',
          isInitContainer: false, // We can't determine this from log data
        });
        // If we were loading containers, mark as complete once we find at least one
        if (loadingContainers.value && availableContainers.value.length > 0) {
          loadingContainers.value = false;
        }
      }
    }

    const line = `[${ PodName }] ${ ContainerName } ${ Message }`;

    if (line == "[]  ___FILTER_START___") {
      // Clear existing logs before new filtered logs arrive
      lines.value = [];
      backlog.value = [];
      return;
    }

    if (line == "[]  ___FILTER_COMPLETE___") {
      isApplyingFilters.value = false;
      return;
    }

    backlog.value.push({
      id:     lastId.value++,
      msg:    props.ansiToHtml ? ansiup.ansi_to_html(line) : line,
      rawMsg: line,
      time:   Timestamp || null,
    });
  });

  socket.value.connect();
};

const flush = () => {
  if (backlog.value.length) {
    lines.value.push(...backlog.value);
    backlog.value = [];
  }

  if (isFollowing.value) {
    nextTick(() => {
      follow();
    });
  }
};

const updateFollowing = () => {
  const el = body.value;

  isFollowing.value = el.scrollTop + el.clientHeight + 2 >= el.scrollHeight;
};

const clear = () => {
  lines.value = [];
};

const download = (btnCb) => {
  const date = new Date().toISOString().split('.')[0];
  const fileName = `${ props.application.nameDisplay }-${ date }`;

  downloadFile(fileName, lines.value.map((l) => `${ l.rawMsg }`).join('\n'))
    .then(() => btnCb(true))
    .catch(() => btnCb(false));
};

const follow = () => {
  body.value.scrollTop = body.value.scrollHeight;
};

const toggleWrap = () => {
  store.dispatch('prefs/set', { key: LOGS_WRAP, value: wrap.value });
};

const format = (time) => {
  if (!time) {
    return '';
  }

  return day(time).format(timeFormatStr.value);
};

const cleanup = () => {
  if (socket.value) {
    socket.value.disconnect();
    socket.value = null;
  }

  clearInterval(timerFlush.value);
};

const clearFilters = () => {
  tail.value = null;
  since.value = null;
  sinceTime.value = null;
  applyFilters();
};

const applyFilters = async () => {
  // Prevent multiple simultaneous reconnections
  if (isApplyingFilters.value) {
    return;
  }

  isApplyingFilters.value = true;

  // Clear existing lines before applying new filters to prevent duplicates
  lines.value = [];
  backlog.value = [];

  try {
    // Clear conflicting filters
    if (sinceTime.value && since.value) {
      sinceTime.value = undefined;
    }

    let sinceTimeParsed = undefined;
    if (sinceTime.value) {
      sinceTimeParsed = new Date(sinceTime.value).toISOString();
    }

    // Build filter params including container filters
    // If no filters are active, resume following mode
    // If filters are active, use one-shot mode (follow: false)
    const hasTimeFilters = tail.value != null || since.value != null || sinceTime.value != null;
    const hasContainerFilters = (filterMode.value === 'include' && selectedContainers.value.size > 0) || excludedContainers.value.size > 0;

    const filterParams: any = {
      follow: !hasTimeFilters && !hasContainerFilters, // Follow only when no filters
      tail: tail.value != null ? tail.value : (!hasTimeFilters && !hasContainerFilters ? 10000 : null),
      since: since.value,
      since_time: sinceTimeParsed,
    };

    // Add container filter parameters
    if (filterMode.value === 'include' && selectedContainers.value.size > 0) {
      filterParams.include_containers = Array.from(selectedContainers.value).join(',');
    }

    if (excludedContainers.value.size > 0) {
      filterParams.exclude_containers = Array.from(excludedContainers.value).join(',');
    }

    const payload = {
      type: 'filter_params',
      params: filterParams
    };

    const payload_string = JSON.stringify(payload);

    socket.value.send(payload_string);

    // Safety timeout: reset flag after 5 seconds even if marker not received
    setTimeout(() => {
      if (isApplyingFilters.value) {
        console.warn('Filter complete marker not received, resetting flag');
        isApplyingFilters.value = false;
      }
    }, 5000);

  } catch (e) {
    console.error('Error applying log filters:', e);
    isApplyingFilters.value = false;
  }
};

// Container filtering functions
const fetchContainers = async () => {
  loadingContainers.value = true;
  try {
    const namespace = props.application?.meta?.namespace;
    const appName = props.application?.meta?.name;

    if (!namespace || !appName) {
      console.warn('Missing namespace or app name for container fetch');
      return;
    }

    const res = await store.dispatch('epinio/request', {
      url: `/api/v1/namespaces/${ namespace }/applications/${ appName }/pods`
    });

    const containers: ContainerInfo[] = [];

    if (res && res.data) {
      for (const pod of res.data) {
        const podName = pod.name;

        // Add main containers
        if (pod.containers) {
          for (const container of pod.containers) {
            containers.push({
              name: container.name,
              podName,
              isInitContainer: false,
            });
          }
        }

        // Add init containers
        if (pod.init_containers) {
          for (const container of pod.init_containers) {
            containers.push({
              name: container.name,
              podName,
              isInitContainer: true,
            });
          }
        }
      }
    }

    availableContainers.value = containers;
  } catch (e) {
    console.error('Error fetching containers:', e);
  } finally {
    loadingContainers.value = false;
  }
};

const isSidecar = (containerName: string): boolean => {
  const sidecarPrefixes = ['linkerd-', 'istio-'];
  return sidecarPrefixes.some(prefix => containerName.startsWith(prefix));
};

const toggleContainer = (containerName: string) => {
  if (filterMode.value === 'include') {
    if (selectedContainers.value.has(containerName)) {
      selectedContainers.value.delete(containerName);
    } else {
      selectedContainers.value.add(containerName);
    }
    selectedContainers.value = new Set(selectedContainers.value);
  } else {
    if (excludedContainers.value.has(containerName)) {
      excludedContainers.value.delete(containerName);
    } else {
      excludedContainers.value.add(containerName);
    }
    excludedContainers.value = new Set(excludedContainers.value);
  }
};

const isContainerSelected = (containerName: string): boolean => {
  if (filterMode.value === 'include') {
    return selectedContainers.value.has(containerName);
  } else {
    return excludedContainers.value.has(containerName);
  }
};

const clearContainerFilters = () => {
  selectedContainers.value.clear();
  excludedContainers.value.clear();
  selectedContainers.value = new Set();
  excludedContainers.value = new Set();
};
</script>

<template>
  <Window
    :active="active"
    :before-close="cleanup"
    class="epinio-app-log"
  >
    <template #title>
      <div class="title-inner log-action ">
        <div class="title-inner-left">
          <Select
            v-if="instanceChoices.length > 1"
            v-model:value="instance"
            :disabled="instanceChoices.length === 1"
            class="containerPicker auto-width"
            :options="instanceChoicesWithNone"
            :clearable="true"
            placement="top"
            placeholder="Filter by Instance"
          />

          <!-- Container Filter Button -->
          <VDropdown placement="bottom-start" :distance="6">
            <button
              class="btn bg-primary ml-5 container-filter-btn"
            >
              Container Filter
            </button>
            <template #popper>
              <div class="container-filter-panel">
                <div class="filter-search">
                  <input
                    v-model="containerSearch"
                    type="text"
                    class="input-sm"
                    placeholder="Search containers..."
                  >
                </div>

                <!-- Show/Hide App Logs Checkbox -->
                <div class="filter-app-checkbox">
                  <Checkbox
                    v-model:value="showAppLogs"
                    label="Show App Logs"
                  />
                </div>

                <div v-if="loadingContainers" class="text-center p-10">
                  Loading containers...
                </div>
                <div v-else-if="filteredContainers.length === 0" class="text-center p-10">
                  No containers found
                </div>
                <div v-else class="container-list">
                  <div
                    v-for="container in filteredContainers"
                    :key="`${container.podName}-${container.name}`"
                    class="container-item"
                    :class="{
                      'is-selected': isContainerSelected(container.name),
                      'is-sidecar': isSidecar(container.name)
                    }"
                    @click="toggleContainer(container.name)"
                  >
                    <Checkbox
                      :value="isContainerSelected(container.name)"
                      :label="container.name"
                    />
                    <span v-if="isSidecar(container.name)" class="badge badge-sm bg-warning">
                      Sidecar
                    </span>
                    <span v-if="container.isInitContainer" class="badge badge-sm bg-info">
                      Init
                    </span>
                  </div>
                </div>

                <!-- Time-based filters -->
                <div class="filter-section">
                  <label class="text-label">Tail (number of lines)</label>
                  <input
                    v-model.number="tail"
                    type="number"
                    class="form-control"
                    placeholder="e.g., 100"
                    min="1"
                  >
                </div>

                <div class="filter-section">
                  <label class="text-label">Since (duration)</label>
                  <input
                    v-model="since"
                    type="text"
                    class="form-control"
                    placeholder="e.g., 1h, 30m, 24h"
                    :disabled="!!sinceTime"
                  >
                  <small class="text-muted">Use this OR Since Time below</small>
                </div>

                <div class="filter-section">
                  <label class="text-label">Since Time (absolute date)</label>
                  <input
                    v-model="sinceTime"
                    type="datetime-local"
                    class="form-control"
                    :disabled="!!since"
                  >
                  <small class="text-muted">Use this OR Since above</small>
                </div>

                <div class="filter-footer">
                  <p class="filter-instruction">
                    {{ filterMode === 'include'
                      ? 'Selected containers will be included in logs'
                      : 'Selected containers will be excluded from logs' }}
                  </p>
                  <div class="mt-10">
                    <button
                      class="btn btn-sm bg-primary"
                      :disabled="isApplyingFilters"
                      @click="applyFilters"
                    >
                      {{ isApplyingFilters ? 'Applying...' : 'Apply Filters' }}
                    </button>
                    <button
                      class="btn btn-sm bg-warning ml-5"
                      :disabled="activeFilterCount === 0 && !tail && !since && !sinceTime"
                      @click="clearContainerFilters(); clearFilters();"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </VDropdown>

          <button
            class="btn bg-primary ml-5"
            :disabled="isFollowing"
            @click="follow"
          >
            {{t('wm.containerLogs.follow')}}
          </button>
           <button
            class=" btn bg-primary ml-5"
            @click="clear"
          >
            {{t('wm.containerLogs.clear')}}
          </button>
          <AsyncButton
            class="ml-5"
            mode="download"
            @click="download"
          />
        </div>
        <div style="flex: 1;" />
        <div class="title-inner-right">
          <div
            class="status log-action text-center p-10"
            style="min-width: 80px;"
          >
            <span :class="{'text-success': isOpen, 'text-error': !isOpen}">
              {{t(isOpen ? 'wm.connection.connected' : 'wm.connection.disconnected')}}
            </span>
          </div>
          <div class="log-action ml-5">
            <VDropdown placement="top-end">
              <button class="btn bg-primary">
                <i class="icon icon-gear" />
              </button>
              <template #popper>
                <div class="filter-popup">
                  <Checkbox
                    v-model:value="wrap"
                    :label="t('wm.containerLogs.wrap')"
                    @update:value="toggleWrap"
                  />
                </div>
              </template>
            </VDropdown>
          </div>
          <div class="log-action  ml-5">
            <input
              v-model="search"
              class="input-sm"
              type="search"
              :placeholder="t('wm.containerLogs.search')"
            >
          </div>
        </div>
      </div>
    </template>
    <template #body>
      <div
        ref="body"
        :class="{'logs-container': true, 'open': isOpen, 'closed': !isOpen, 'show-times': timestamps && filtered.length, 'wrap-lines': wrap}"
      >
        <table
          class="fixed"
          cellpadding="0"
          cellspacing="0"
        >
          <tbody class="logs-body">
            <template v-if="filtered.length">
              <tr
                v-for="line in filtered"
                :key="line.id"
              >
                <td
                  v-clean-html="format(line.time)"
                  class="time"
                />
                <td
                  v-clean-html="line.msg"
                  class="msg"
                />
              </tr>
            </template>
            <tr v-else-if="search || activeFilterCount > 0">
              <td colspan="2" class="msg text-muted">
                {{t('wm.containerLogs.noMatch')}}
                <span v-if="activeFilterCount > 0" class="filter-indicator">
                  ({{ filterMode === 'include' ? 'Including' : 'Excluding' }} {{ activeFilterCount }} container{{ activeFilterCount !== 1 ? 's' : '' }})
                </span>
              </td>
            </tr>
            <tr v-else>
              <td colspan="2" class="msg text-muted">
                {{t('epinio.applications.wm.noData')}}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Window>
</template>

<style lang="scss">
.epinio-app-log {
  .v-select.inline.vs--single.vs--open .vs__selected {
    position: inherit;
  }
}
</style>

<style lang="scss" scoped>
  .title-inner {
    display: flex;
    flex-direction: row;
  }
  .title-inner {
    display: flex;
    flex-direction: row;
    &-left, &-right {
      display: flex;
      flex-direction: row;
    }
  }

  .logs-container {
    height: 100%;
    overflow: auto;
    padding: 5px;
    background-color: var(--logs-bg);
    font-family: Menlo,Consolas,monospace;
    color: var(--logs-text);

    .closed {
      opacity: 0.25;
    }

    .time {
      white-space: nowrap;
      display: none;
      width: 0;
      padding-right: 15px;
      user-select: none;
    }

    &.show-times .time {
      display: initial;
      width: auto;
    }

    .msg {
      white-space: nowrap;

      .highlight {
        color: var(--logs-highlight);
        background-color: var(--logs-highlight-bg);
      }
    }

    &.wrap-lines .msg {
      white-space: normal;
    }
  }

  .containerPicker {
    ::v-deep &.unlabeled-select {
      display: inline-block;
      min-width: 200px;
      height: 30px;
      min-height: 30px;
      width: initial;
    }
  }

  .log-action {
    button {
      border: 0 !important;
      min-height: 30px;
      line-height: 30px;
    }

    > input {
      height: 30px;
    }
  }

  .status {
    align-items: center;
    display: flex;
    min-width: 80px;
    height: 30px;
  }

  .filter-popup {
    padding: 10px;
    width: 280px;
    position: relative;
    overflow: visible;

    > * {
      margin-bottom: 10px;
    }

    .filter-section {
      margin-top: 15px;

      .text-label {
        display: block;
        margin-bottom: 5px;
        font-size: 12px;
        font-weight: 600;
      }

      .form-control {
        width: 100%;
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 3px;
        background-color: var(--input-bg);
        color: var(--input-text);

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .text-muted {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        opacity: 0.7;
      }
    }

    .mt-10 {
      margin-top: 10px;
    }
  }

  .title-left {
    display: flex;
  }

  .container-filter-btn {
    display: flex;
    align-items: center;
  }

  .container-filter-panel {
    min-width: 300px;
    max-width: 400px;
    max-height: 500px;
    display: flex;
    flex-direction: column;
    padding: 10px;
    color: var(--body-text);


    .filter-search {
      margin-bottom: 10px;

      input {
        width: 100%;
      }
    }

    .filter-app-checkbox {
      margin-bottom: 10px;
      padding: 6px 8px;
    }

    .container-list {
      flex: 1;
      overflow-y: auto;
      max-height: 250px;
      margin-bottom: 10px;

      .container-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.2s;
        color: var(--body-text);

        &:hover {
          background-color: var(--hover-bg);
        }

        &.is-selected,
        &.active-nav {
          background-color: var(--body-bg);
          color: var(--body-text);
        }

        &.is-sidecar {
          opacity: 0.8;
        }

        :deep(label),
        :deep(.checkbox-label) {
          color: var(--body-text);
        }

        .badge {
          font-size: 10px;
          padding: 2px 6px;
        }
      }
    }

    .filter-section {
      margin-top: 15px;

      .text-label {
        display: block;
        margin-bottom: 5px;
        font-size: 12px;
        font-weight: 600;
      }

      .form-control {
        width: 100%;
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 3px;
        background-color: var(--input-bg);
        color: var(--input-text);

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .text-muted {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        opacity: 0.7;
      }
    }

    .filter-footer {
      display: flex;
      flex-direction: column;
      padding-top: 10px;
      border-top: 1px solid var(--border);

      .filter-instruction {
        font-size: 12px;
        color: var(--body-text);
        line-height: 1.4;
      }
    }
  }

  .filter-indicator {
    display: block;
    margin-top: 5px;
    font-size: 12px;
  }
</style>
