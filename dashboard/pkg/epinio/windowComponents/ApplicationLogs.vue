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


  //const currentDate = new Date();
  //const currentUnixTimestampMs = currentDate.getTime();
  //const oneHourInMs = 60 * 60 * 1000;
  //const futureUnixTimestampMs = currentUnixTimestampMs + oneHourInMs;

  return addParams(url, { follow: true, authtoken: token });
};

const connect = async () => {
  if (socket.value) {
    await socket.value.disconnect();
    socket.value = null;
    lines.value = [];
  }

  lines.value = [];

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

    const { PodName, Message } = parsedData;

    const line = `[${ PodName }] ${ Message }`;
    backlog.value.push({
      id:     lastId.value++,
      msg:    props.ansiToHtml ? ansiup.ansi_to_html(line) : line,
      rawMsg: line,
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
    > * {
      margin-bottom: 10px;
    }
  }

  .title-left {
    display: flex;
  }
</style>

