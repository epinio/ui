<script setup lang="ts">
import { useStore } from 'vuex';
import { 
  ref, 
  onMounted, 
  onBeforeUnmount, 
  watch,
} from 'vue';

import { allHash } from '@shell/utils/promise';
import { addParams } from '@shell/utils/url';
import { base64Decode, base64Encode } from '@shell/utils/crypto';
import Select from '@shell/components/form/Select';

import Socket, {
  EVENT_CONNECTED,
  EVENT_CONNECTING,
  EVENT_DISCONNECTED,
  EVENT_MESSAGE,
  EVENT_CONNECT_ERROR,
} from '@shell/utils/socket';
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

const xterm = ref<HTMLElement>(null);
const instance = ref<String>(props.initialInstance || instanceChoices[0]);
const terminal = ref<Object>(null);
const fitAddon = ref<Object>(null);
const searchAddon = ref<Object>(null);
const webglAddon = ref<Object>(null);
const isOpening = ref<Boolean>(false);
const keepAliveTimer = ref<Object>(null);
const xtermConfig = {
  allowProposedApi: true,
  cursorBlink:      true,
  useStyle:         true,
  fontSize:         12,
};

watch(
  () => instance.value,
  () => {
    console.log("TEST");
    connect();
  }
);

/*watch(
  height,
  () => {
    fit();
  }
);*/

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
  const docStyle = getComputedStyle(document.querySelector('body'));
  const xtermLib = await import('xterm');

  const addons = await allHash({
    fit:      import('xterm-addon-fit'),
    webgl:    import('xterm-addon-webgl'),
    weblinks: import('xterm-addon-web-links'),
    search:   import('xterm-addon-search'),
  });

  console.log("Terminal Cursor: ", docStyle.getPropertyValue('--terminal-cursor').trim());

  const terminalTemp = new xtermLib.Terminal({
    theme: {
      background: docStyle.getPropertyValue('--terminal-bg').trim(),
      foreground: docStyle.getPropertyValue('--terminal-text').trim(),
      cursor: docStyle.getPropertyValue('--terminal-cursor').trim(),
      selectionBackground: docStyle.getPropertyValue('--terminal-selection').trim(),
    },
    ...xtermConfig,
  });

  fitAddon.value = new addons.fit.FitAddon();
  searchAddon.value = new addons.search.SearchAddon();

  try {
    webglAddon.value = new addons.webgl.WebGlAddon();
  } catch (e) {
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

  fit();
  flush();

  terminalTemp.onData((input) => {
    const msg = `0${ base64Encode(input) }`;

    write(msg);
  });

  terminal.value = terminalTemp;
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

  socket.value.addEventListener(EVENT_CONNECTING, (e) => {
    isOpen.value = false;
    isOpening.value = true;
  });

  socket.value.addEventListener(EVENT_CONNECT_ERROR, (e) => {
    isOpen.value = false;
    isOpening.value = false;
    console.error('Connect Error', e); // eslint-disable-line no-console
  });

  socket.value.addEventListener(EVENT_CONNECTED, (e) => {
    isOpen.value = true;
    isOpening.value = false;
    fit();
    flush();
  });

  socket.value.addEventListener(EVENT_DISCONNECTED, (e) => {
    isOpen.value = false;
    isOpening.value = false;
  });

  socket.value.addEventListener(EVENT_MESSAGE, (e) => {
    const type = e.detail.data.substr(0, 1);
    const msg = base64Decode(e.detail.data.substr(1));

    if (`${ type }` === '1') {
      terminal.value.write(msg);
    } else {
      console.error(msg); // eslint-disable-line no-console
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
  <Window
    :active="active"
    :before-close="cleanup"
    class="epinio-app-shell"
  >
    <template #title>
      <Select
        v-if="instanceChoices.length > 1"
        v-model:value="instance"
        :disabled="instanceChoices.length === 1"
        class="containerPicker auto-width pull-left"
        :options="instanceChoices"
        :clearable="false"
        placement="top"
      />
      <div class="pull-left ml-5">
        <button
          class="btn btn-sm bg-primary"
          @click="clear"
        >
          {{t('wm.containerShell.clear')}}
        </button>
      </div>
      <div class="status pull-left">
        <span v-if="isOpen" class="text-success">
          {{t('wm.connection.connected')}}
        </span>
        <span 
          v-else-if="isOpening"
          class="text-warning"
          v-clean-html="t('wm.connection.connecting')"
        />
        <span 
          v-else
          class="text-error"
        >
          {{t('wm.connection.disconnected')}}
        </span>
      </div>
    </template>
    <template #body>
      <div
        class="shell-container"
        :class="{ open: isOpen, closed: !isOpen }"
      >
        <div
          ref="xterm"
          class="shell-body"
        />
        <resize-observer @notify="fit" />
      </div>
    </template>
  </Window>
</template>

<style lang="scss">
.epinio-app-shell {
  .v-select.inline.vs--single.vs--open .vs__selected {
    position: inherit;
  }
}
</style>

<style lang="scss" scoped>
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

.containerPicker {
  ::v-deep &.unlabeled-select {
    display: inline-block;
    min-width: 200px;
    height: 30px;
    min-height: 30px;
    width: initial;
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

