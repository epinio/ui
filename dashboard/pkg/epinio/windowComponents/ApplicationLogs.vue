<script setup lang="ts">
import { useStore } from 'vuex';
import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  nextTick,
  PropType,
  watch,
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

interface LogFilters {
  includeContainers: string[];
  excludeContainers: string[];
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

const ansiup = new AnsiUp();
const timestamps = store.getters['prefs/get'](LOGS_TIME);
const wrap = ref<boolean>(store.getters['prefs/get'](LOGS_WRAP));

// Container filtering state
const availableContainers = ref<ContainerInfo[]>([]);
const selectedContainers = ref<Set<string>>(new Set());
const excludedContainers = ref<Set<string>>(new Set());
const filterMode = ref<'include' | 'exclude'>('exclude');
const containerFilterOpen = ref<boolean>(false);
const containerSearch = ref<string>('');
const loadingContainers = ref<boolean>(false);
const showAppLogs = ref<boolean>(true);

onMounted(async () => {
  await fetchContainers();
  // Connect after containers are fetched so filters can be applied
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
        // App logs are from containers that are NOT sidecars
        // Keep only sidecar logs when app logs are hidden
        if (!isSidecarContainer) {
          console.log(`[Filtered] Hiding app log from existing logs, container: ${containerName}`);
        }
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

  const params: any = {
    follow: true,
    authtoken: token
  };

  // Add container filter parameters
  if (filterMode.value === 'include' && selectedContainers.value.size > 0) {
    params.include_containers = Array.from(selectedContainers.value).join(',');
  }
  
  if (excludedContainers.value.size > 0) {
    params.exclude_containers = Array.from(excludedContainers.value).join(',');
  }

  return addParams(url, params);
};

const connect = async (preserveLogs = false) => {
  if (socket.value) {
    await socket.value.disconnect();
    socket.value = null;
    if (!preserveLogs) {
      lines.value = [];
    }
  }

  if (!preserveLogs) {
    lines.value = [];
  }

  const url = await getSocketUrl();
  socket.value = new Socket(url, true, 0);
  socket.value.setAutoReconnectUrl(async() => {
    return await getSocketUrl();
  });

  socket.value.addEventListener(EVENT_CONNECTED, () => {
    isOpen.value = true;
  });

  socket.value.addEventListener(EVENT_DISCONNECTED, () => {
    isOpen.value = false;
  });

  socket.value.addEventListener(EVENT_CONNECT_ERROR, (e: any) => {
    isOpen.value = false;
    console.error('Connect Error', e);
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

// Check if this is a staging log endpoint
const isStagingLog = computed(() => {
  return props.endpoint?.includes('/staging/') || props.endpoint?.includes('/wapi/v1');
});

// Extract stage ID from endpoint if it's a staging log
const stageId = computed(() => {
  if (!isStagingLog.value || !props.endpoint) {
    return null;
  }
  const match = props.endpoint.match(/\/staging\/([^/]+)/);
  return match ? match[1] : null;
});

// Container discovery
const fetchContainers = async () => {
  if (!props.application) {
    return;
  }

  loadingContainers.value = true;
  try {
    const namespace = props.application.meta?.namespace || 'default';
    const appName = props.application.nameDisplay || props.application.metadata?.name;

    if (!appName) {
      return;
    }

    // For staging logs, we can't easily fetch pods via the application pods API
    // Containers will be discovered from incoming log data as a fallback
    if (isStagingLog.value) {
      // Staging logs: containers will be discovered from incoming log data
      // Keep loading state true so the filter button shows, but indicate discovery from logs
      // The loading will be set to false once containers are discovered from log messages
      return;
    }

    // Try to fetch pods for the application
    const podsUrl = `/api/v1/namespaces/${namespace}/applications/${appName}/pods`;
    const response = await store.dispatch('epinio/request', {
      opt: { url: podsUrl }
    });

    const containers: ContainerInfo[] = [];
    const pods = response?.data || [];

    pods.forEach((pod: any) => {
      // Extract init containers
      if (pod.spec?.initContainers) {
        pod.spec.initContainers.forEach((container: any) => {
          containers.push({
            name: container.name,
            podName: pod.metadata?.name || '',
            isInitContainer: true,
          });
        });
      }

      // Extract regular containers
      if (pod.spec?.containers) {
        pod.spec.containers.forEach((container: any) => {
          containers.push({
            name: container.name,
            podName: pod.metadata?.name || '',
            isInitContainer: false,
          });
        });
      }
    });

    // Remove duplicates (same container name across pods)
    const uniqueContainers = Array.from(
      new Map(containers.map(c => [c.name, c])).values()
    );

    availableContainers.value = uniqueContainers;
  } catch (error) {
    console.warn('Failed to fetch containers:', error);
    // If pods API doesn't exist, try to extract from log data as fallback
  } finally {
    loadingContainers.value = false;
  }
};

// Container filtering functions
const toggleContainer = (containerName: string, checked: boolean) => {
  // checked = true means show logs (not excluded)
  // checked = false means hide logs (excluded)
  if (checked) {
    // Checkbox is checked - remove from exclusion list to show logs
    excludedContainers.value.delete(containerName);
  } else {
    // Checkbox is unchecked - add to exclusion list to hide logs
    excludedContainers.value.add(containerName);
  }
  applyFilters();
};

const applyFilters = async () => {
  // Reconnect with new filters, but preserve existing logs
  // Filter existing logs client-side while waiting for new filtered logs
  await connect(true);
};

const clearFilters = () => {
  selectedContainers.value.clear();
  excludedContainers.value.clear();
  applyFilters();
};

const isContainerSelected = (containerName: string): boolean => {
  // Checked = not excluded (default all checked)
  return !excludedContainers.value.has(containerName);
};

const filteredContainers = computed(() => {
  // Only show sidecar containers
  const sidecarContainers = availableContainers.value.filter(c => isSidecar(c.name));
  
  if (!containerSearch.value) {
    return sidecarContainers;
  }

  const searchLower = containerSearch.value.toLowerCase();
  return sidecarContainers.filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.podName.toLowerCase().includes(searchLower)
  );
});

const activeFilterCount = computed(() => {
  if (filterMode.value === 'include') {
    return selectedContainers.value.size;
  } else {
    return excludedContainers.value.size;
  }
});

const isSidecar = (containerName: string): boolean => {
  if (!containerName) return false;
  const sidecarPatterns = ['istio-', 'linkerd-', 'envoy-', 'sidecar-'];
  return sidecarPatterns.some(pattern => containerName.startsWith(pattern));
};


// Watch for filter changes and reconnect
watch([selectedContainers, excludedContainers, filterMode], () => {
  // Debounce: reconnect will be called by applyFilters
}, { deep: true });
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

          <VDropdown
            v-if="availableContainers.length > 0 || loadingContainers"
            v-model:open="containerFilterOpen"
            placement="bottom-start"
            class="ml-5"
          >
            <button
              class="btn bg-primary container-filter-btn"
              :class="{'has-filters': activeFilterCount > 0}"
            >
              <i class="icon icon-filter" />
              <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
              Containers
            </button>
            <template #popper>
              <div class="container-filter-panel">
                <div class="filter-search">
                  <input
                    v-model="containerSearch"
                    class="input-sm"
                    type="search"
                    placeholder="Search containers..."
                  />
                </div>

                <div class="filter-app-checkbox">
                  <Checkbox
                    :value="showAppLogs"
                    label="app"
                    @update:value="(checked: boolean) => showAppLogs = checked"
                  />
                </div>

                <div class="container-list">
                  <div
                    v-if="loadingContainers && availableContainers.length === 0"
                    class="text-muted p-10 text-center"
                  >
                    <i class="icon icon-spinner icon-spin" />
                    Discovering containers from logs...
                  </div>
                  <template v-else>
                    <div
                      v-for="container in filteredContainers"
                      :key="container.name"
                      class="container-item"
                      :class="{
                        'is-sidecar': isSidecar(container.name),
                        'is-selected': isContainerSelected(container.name),
                        'active-nav': isContainerSelected(container.name)
                      }"
                    >
                      <Checkbox
                        :value="isContainerSelected(container.name)"
                        :label="container.name"
                        @update:value="(checked) => toggleContainer(container.name, checked)"
                      />
                      <span
                        v-if="container.isInitContainer"
                        class="badge badge-sm bg-info"
                      >
                        init
                      </span>
                    </div>
                    <div
                      v-if="filteredContainers.length === 0 && !loadingContainers"
                      class="text-muted p-10 text-center"
                    >
                      No containers found
                    </div>
                  </template>
                </div>

                <div class="filter-footer">
                  <div class="filter-instruction">
                    Uncheck the container name to exclude their logs.
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
          <div class="log-action  ml-5">
            <input
              v-model="search"
              class="input-sm"
              type="search"
              :placeholder="t('wm.containerLogs.search')"
            >
          </div>
          <div class="log-action ml-5">
            <VDropdown placement="top">
              <button class="btn bg-primary">
                <i class="icon icon-gear" />
              </button>
              <template #popper>
                <Checkbox
                  v-model:value="wrap"
                  :label="t('wm.containerLogs.wrap')"
                  @update:value="toggleWrap"
                />
              </template>
            </VDropdown>
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
  // .title-left {

  // }

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
    > * {
      margin-bottom: 10px;
    }
  }

  .title-left {
    display: flex;
  }

  .container-filter-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;

    &.has-filters {
      border: 1px solid var(--primary);
    }

    .filter-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: var(--error);
      color: white;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
    }
  }

  .container-filter-panel {
    min-width: 300px;
    max-width: 400px;
    max-height: 500px;
    display: flex;
    flex-direction: column;
    background: var(--body-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
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

