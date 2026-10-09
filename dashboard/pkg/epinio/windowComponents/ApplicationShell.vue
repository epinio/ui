<script setup lang="ts">
import { useStore } from 'vuex';
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  PropType,
} from 'vue';

import Socket, {
  EVENT_CONNECTED,
  EVENT_CONNECTING,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
  EVENT_CONNECT_ERROR,
} from '../utils/socket';
import { allHash, addParams, base64Decode, base64Encode } from '../utils/browser';
import { useApplicationSocketMixin } from './ApplicationSocketMixin';
import { App } from '../models/application/ui-types';

const store = useStore();
const t = store.getters['i18n/t'];

const props = defineProps({
  application: {
    type: Object as PropType<App>,
    default: null,
  },
  endpoint: {
    type: String as PropType<string>,
    default: '',
  },
  initialInstance: {
    type: String,
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

const xterm = ref<HTMLElement | null>(null);
const instance = ref<string>(props.initialInstance || instanceChoices.value[0]);
const instanceOptions = computed(() => instanceChoices.value.map((choice: string) => ({ label: choice, value: choice })));
const terminal = ref<any>(null);
const fitAddon = ref<any>(null);
const searchAddon = ref<any>(null);
const webglAddon = ref<any>(null);
const isOpening = ref<boolean>(false);
const keepAliveTimer = ref<object | null>(null);
const xtermConfig = {
  allowProposedApi: true,
  cursorBlink:      true,
  useStyle:         true,
  fontSize:         12,
};

let themeObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

// xterm reads these CSS vars once at construction and bakes them into its
// own theme object, it doesn't react to CSS changes the way the rest of the
// UI does. Without this, switching light/dark mode leaves an open terminal
// stuck on whatever colors it started with.
const getTerminalTheme = () => {
  const docStyle = getComputedStyle(document.body);

  return {
    background:          docStyle.getPropertyValue('--terminal-bg').trim(),
    foreground:          docStyle.getPropertyValue('--terminal-text').trim(),
    cursor:              docStyle.getPropertyValue('--terminal-cursor').trim(),
    selectionBackground: docStyle.getPropertyValue('--terminal-selection').trim(),
  };
};

watch(
  () => instance.value,
  () => {
    connect();
  }
);

onBeforeUnmount(() => {
  clearInterval(keepAliveTimer.value);
  cleanup();
});

onMounted(async () => {
  await setupTerminal();
  await connect();

  isOpen.value = true;

  clearInterval(keepAliveTimer.value);
  keepAliveTimer.value = setInterval(() => {
    fit();
  }, 60 * 1000);
}); 

const setupTerminal = async () => {
  const xtermLib = await import('xterm');

  const addons = await allHash({
    fit:      import('xterm-addon-fit'),
    webgl:    import('xterm-addon-webgl'),
    weblinks: import('xterm-addon-web-links'),
    search:   import('xterm-addon-search'),
  });

  const terminalTemp = new xtermLib.Terminal({
    theme: getTerminalTheme(),
    ...xtermConfig,
  });

  fitAddon.value = new addons.fit.FitAddon();
  searchAddon.value = new addons.search.SearchAddon();

  try {
    webglAddon.value = new addons.webgl.WebglAddon();
  } catch (e: any) { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Some browsers (Safari) don't support the webgl renderer, so don't use it.
    webglAddon.value = null;
  }

  terminalTemp.loadAddon(fitAddon.value);
  terminalTemp.loadAddon(searchAddon.value);
  terminalTemp.loadAddon(new addons.weblinks.WebLinksAddon());
  if (webglAddon.value) {
    terminalTemp.loadAddon(webglAddon.value);
  }
  
  terminalTemp.open(xterm.value);

  resizeObserver = new ResizeObserver(() => fit());
  resizeObserver.observe(xterm.value as HTMLElement);

  fit();
  flush();

  terminalTemp.onData((input) => {
    const msg = `0${ base64Encode(input) }`;

    write(msg);
  });

  terminal.value = terminalTemp;

  themeObserver = new MutationObserver(() => {
    if (terminal.value) {
      terminal.value.options.theme = getTerminalTheme();
    }
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
};

const write = (msg) => {
  if (isOpen.value) {
    socket.value.send(msg);
  } else {
    backlog.value.push(msg);
  }
};

const clear = () => {
  terminal.value.clear();
};

const getSocketUrl = async () => {
  const { url, token } = await getRootSocketUrl();

  return addParams(url, {
    authtoken: token,
    instance: instance.value,
  });
};

const connect = async () => {
  if (socket.value) {
    await socket.value.disconnect();
    socket.value = null;
    terminal.value.reset();
  }

  const url = await getSocketUrl();

  if (!url) {
    return;
  }

  socket.value = new Socket(url, false, 0, 'base64.channel.k8s.io');

  socket.value.addEventListener(EVENT_CONNECTING, () => {
    isOpen.value = false;
    isOpening.value = true;
  });

  socket.value.addEventListener(EVENT_CONNECT_ERROR, (e) => {
    isOpen.value = false;
    isOpening.value = false;
    console.error('Connect Error', e);
  });

  socket.value.addEventListener(EVENT_CONNECTED, () => {
    isOpen.value = true;
    isOpening.value = false;
    fit();
    flush();
  });

  socket.value.addEventListener(EVENT_DISCONNECTED, () => {
    isOpen.value = false;
    isOpening.value = false;
  });

  socket.value.addEventListener(EVENT_MESSAGE, (e) => {
    const type = e.detail.data.substr(0, 1);
    const msg = base64Decode(e.detail.data.substr(1));

    // Kubelet exec WS channels: 1=stdout, 2=stderr, 3=error/status, 4=resize.
    // Render both stdout and stderr in the terminal; only surface channel 3
    // (proxy/status messages) to the console.
    if (type === '1' || type === '2') {
      terminal.value.write(msg);
    } else {
      console.error(msg);
    }
  });

  socket.value.connect();
  terminal.value.focus();
};

const flush = () => {
  const backlogTemp = backlog.value.slice();

  backlog.value = [];

  for (const data of backlogTemp) {
    socket.value.send(data);
  }
};

const fit = () => {
  if (!fitAddon.value) {
    return;
  }
  
  fitAddon.value.fit();
  const { rows, cols } = fitAddon.value.proposeDimensions();

  if (!isOpen.value) {
    return;
  }

  const message = `4${ base64Encode(
    JSON.stringify({
      Width:  Math.floor(cols),
      Height: Math.floor(rows),
    })
  ) }`;

  socket.value.send(message);
};

const cleanup = () => {
  themeObserver?.disconnect();
  themeObserver = null;

  resizeObserver?.disconnect();
  resizeObserver = null;

  if (socket.value) {
    socket.value.disconnect();
    socket.value = null;
  }

  if (terminal.value) {
    terminal.value.dispose();
    terminal.value = null;
  }
};
</script>

<template>
  <div class="epinio-app-shell">
    <div class="dock-tab-toolbar">
      <trailhand-dropdown
        v-if="instanceChoices.length > 1"
        class="pull-left"
        :value="instance"
        :options="instanceOptions"
        size="small"
        position="top"
        @dropdown-change="(e: CustomEvent) => instance = e.detail.value"
      />
      <div class="pull-left ml-5">
        <trailhand-button
          size="small"
          @click="clear"
        >
          {{t('wm.containerShell.clear')}}
        </trailhand-button>
      </div>
      <div class="status pull-left">
        <span v-if="isOpen" class="text-success">
          {{t('wm.connection.connected')}}
        </span>
        <span
          v-else-if="isOpening"
          v-clean-html="t('wm.connection.connecting')"
          class="text-warning"
        />
        <span
          v-else
          class="text-error"
        >
          {{t('wm.connection.disconnected')}}
        </span>
      </div>
    </div>
    <div class="dock-tab-body">
      <div
        class="shell-container"
        :class="{ open: isOpen, closed: !isOpen }"
      >
        <div
          ref="xterm"
          class="shell-body"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.epinio-app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.dock-tab-toolbar {
  flex-shrink: 0;
  order: 2;
  display: flex;
  align-items: center;
  padding: 10px;
  border-top: 1px solid var(--border);
}

.dock-tab-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.text-warning {
  animation: flasher 2.5s linear infinite;
}

@keyframes flasher {
  50% {
    opacity: 0;
  }
}

.shell-container {
  height: 100%;
  overflow: hidden;
}

.shell-body {
  padding: calc(2 * var(--outline-width));
  height: 100%;

  & > .terminal.focus {
    outline: var(--outline-width) solid var(--outline);
  }
}

.status {
  align-items: center;
  display: flex;
  min-width: 80px;
  height: 30px;
  margin-left: 10px;
}
</style>
