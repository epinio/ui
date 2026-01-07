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

const ansiup = new AnsiUp();
const timestamps = store.getters['prefs/get'](LOGS_TIME);
const wrap = ref<boolean>(store.getters['prefs/get'](LOGS_WRAP));

onMounted(async () => {
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
  if (!search.value && !instance.value) {
    return lines.value;
  }

  const re = new RegExp(escapeRegex(search.value), 'img');
  const out = [];

  for (const line of lines.value) {
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

  // Add optional filter parameters if they have values
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

    const line = `[${ PodName }] ${ ContainerName } ${ Message }`;

    // If logs are being filtered, make sure there are no old lines, and
    // ensure there aren't repeat lines.
    if (
      tail.value != undefined ||
      since.value != undefined ||
      sinceTime.value != undefined
    ) {
      lines.value.length = 0;
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

const applyFilters = async () => {
  // Prevent multiple simultaneous reconnections
  if (isApplyingFilters.value) {
    return;
  }

  isApplyingFilters.value = true;

  try {
    // Clear conflicting filters
    if (sinceTime.value && since.value) {
      sinceTime.value = undefined;
    }

    let sinceTimeParsed = undefined;
    if (sinceTime.value) {
      sinceTimeParsed = new Date(sinceTime.value).toISOString();
    }

    const payload = {
      type: 'filter_params',
      params: {
        follow: false,
        tail: tail.value,
        since: since.value,
        since_time: sinceTimeParsed,
      }
    };

    const payload_string = JSON.stringify(payload);

    socket.value.send(payload_string);

  } catch (e) {
    console.error('Error applying log filters:', e);
  }
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

                  <div>
                    <button
                      class="btn btn-sm bg-primary mt-10"
                      :disabled="isApplyingFilters"
                      @click="applyFilters"
                    >
                      {{ isApplyingFilters ? 'Applying...' : 'Apply Filters' }}
                    </button>
                    <button
                      class="btn btn-sm bg-warning mt-10 ml-5"
                      :disabled="!tail && !since && !sinceTime"
                      @click="
                        tail = null;
                        since = null;
                        sinceTime = null;
                        applyFilters();
                      "
                    >
                      Clear Filters
                    </button>
                  </div>
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
            <tr v-else-if="search">
              <td colspan="2" class="msg text-muted">
                {{t('wm.containerLogs.noMatch')}}
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
</style>

