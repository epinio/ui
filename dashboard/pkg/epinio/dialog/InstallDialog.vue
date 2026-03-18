<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useStore } from 'vuex';

import { LabeledInput } from '@components/Form/LabeledInput';
import { Banner } from '@components/Banner';
import EpinioCluster from '../models/epiniomgmt/epinio.io.management.cluster';

const store = useStore();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const props = defineProps<{
  cluster: EpinioCluster,
}>();

const OPERATOR_NAMESPACE = 'epinio-system';
const CR_GROUP = 'epinio.apps.example.com';
const CR_VERSION = 'v1alpha1';
const CR_PLURAL = 'installepinios';

// ---- form state ----
const domain = ref('');
const targetNamespace = ref('epinio');
const version = ref('');

// ---- page state ----
type Phase = 'form' | 'polling' | 'done' | 'failed';
const phase = ref<Phase>('form');
const busy = ref(false);
const errors = ref<string[]>([]);

// ---- installed CR identity (for polling) ----
const crName = ref('');
const statusMessage = ref('');

// ---- polling ----
let pollTimer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => stopPolling());

function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// ---- helpers ----
function k8sUrl(name = ''): string {
  const base = `/k8s/clusters/${ props.cluster.id }/apis/${ CR_GROUP }/${ CR_VERSION }/namespaces/${ OPERATOR_NAMESPACE }/${ CR_PLURAL }`;

  return name ? `${ base }/${ name }` : base;
}

async function k8sRequest(opt: Record<string, any>) {
  return store.dispatch('cluster/request', opt, { root: true });
}

// ---- duplicate check ----
async function hasActiveInstall(ns: string): Promise<boolean> {
  try {
    const list = await k8sRequest({ url: k8sUrl() });
    const items: any[] = list?.items ?? [];

    return items.some((item: any) => {
      if (item.spec?.targetNamespace !== ns) return false;
      const conditions: any[] = item.status?.conditions ?? [];
      const available = conditions.find((c: any) => c.type === 'Available');
      const progressing = conditions.find((c: any) => c.type === 'Progressing');

      return available?.status === 'True' || progressing?.status === 'True';
    });
  } catch {
    return false;
  }
}

// ---- submit ----
async function install() {
  errors.value = [];
  if (!domain.value.trim()) errors.value.push('Domain is required');
  if (!targetNamespace.value.trim()) errors.value.push('Target Namespace is required');
  if (!version.value.trim()) errors.value.push('Version is required');
  if (errors.value.length) return;

  busy.value = true;
  try {
    const duplicate = await hasActiveInstall(targetNamespace.value.trim());

    if (duplicate) {
      errors.value = [`An install for namespace "${ targetNamespace.value.trim() }" is already in progress or completed on this cluster.`];
      busy.value = false;
      return;
    }

    const res = await k8sRequest({
      url:     k8sUrl(),
      method:  'post',
      headers: { 'content-type': 'application/json' },
      data:    {
        apiVersion: `${ CR_GROUP }/${ CR_VERSION }`,
        kind:       'InstallEpinio',
        metadata:   {
          generateName: 'install-epinio-',
          namespace:    OPERATOR_NAMESPACE,
        },
        spec: {
          domain:          domain.value.trim(),
          targetNamespace: targetNamespace.value.trim(),
          version:         version.value.trim(),
        },
      },
    });

    crName.value = res?.metadata?.name ?? '';
    statusMessage.value = 'Install request accepted — waiting for operator…';
    phase.value = 'polling';
    schedulePoll();
  } catch (err: any) {
    errors.value = [err?.data?.message || err?.message || String(err)];
  } finally {
    busy.value = false;
  }
}

// ---- polling loop ----
function schedulePoll(delayMs = 4000) {
  pollTimer = setTimeout(poll, delayMs);
}

async function poll() {
  if (!crName.value) return;
  try {
    const cr = await k8sRequest({ url: k8sUrl(crName.value) });
    const conditions: any[] = cr?.status?.conditions ?? [];

    const available = conditions.find((c: any) => c.type === 'Available');
    const progressing = conditions.find((c: any) => c.type === 'Progressing');
    const degraded = conditions.find((c: any) => c.type === 'Degraded');

    if (available?.status === 'True') {
      statusMessage.value = available.message || 'Epinio installed successfully.';
      phase.value = 'done';
      stopPolling();
    } else if (degraded?.status === 'True') {
      statusMessage.value = degraded.message || 'Install failed.';
      phase.value = 'failed';
      stopPolling();
    } else if (progressing?.status === 'True') {
      statusMessage.value = progressing.message || 'Install is in progress…';
      schedulePoll();
    } else {
      statusMessage.value = 'Waiting for operator to start…';
      schedulePoll();
    }
  } catch {
    statusMessage.value = 'Could not reach the cluster — retrying…';
    schedulePoll(8000);
  }
}

function close() {
  stopPolling();
  emit('close');
}
</script>

<template>
  <div class="install-dialog">
    <h4 class="install-dialog__title">
      Install Epinio on <strong>{{ cluster.name }}</strong>
    </h4>

    <!-- ── FORM ── -->
    <template v-if="phase === 'form'">
      <div
        v-if="errors.length"
        class="install-dialog__errors"
      >
        <Banner
          v-for="(err, idx) in errors"
          :key="idx"
          color="error"
          :label="err"
        />
      </div>

      <form
        class="install-dialog__form"
        @submit.prevent="!busy && install()"
      >
        <div class="mb-20">
          <LabeledInput
            v-model:value="domain"
            label="Domain"
            placeholder="e.g. demo.example.test"
            :required="true"
            :disabled="busy"
          />
        </div>
        <div class="mb-20">
          <LabeledInput
            v-model:value="targetNamespace"
            label="Target Namespace"
            placeholder="epinio"
            :required="true"
            :disabled="busy"
          />
        </div>
        <div class="mb-20">
          <LabeledInput
            v-model:value="version"
            label="Version"
            placeholder="e.g. 1.0.0"
            :required="true"
            :disabled="busy"
          />
        </div>

        <div class="install-dialog__actions">
          <button
            type="button"
            class="btn role-secondary"
            :disabled="busy"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn role-primary"
            :class="{ disabled: busy }"
            :disabled="busy"
          >
            {{ busy ? 'Checking…' : 'Install' }}
          </button>
        </div>
      </form>
    </template>

    <!-- ── POLLING / IN PROGRESS ── -->
    <template v-else-if="phase === 'polling'">
      <div class="install-dialog__status">
        <i class="icon icon-spinner icon-spin install-dialog__spinner" />
        <p>{{ statusMessage }}</p>
      </div>
      <div class="install-dialog__actions">
        <button
          class="btn role-secondary"
          @click="close"
        >
          Close (install continues in background)
        </button>
      </div>
    </template>

    <!-- ── SUCCESS ── -->
    <template v-else-if="phase === 'done'">
      <Banner
        color="success"
        :label="statusMessage"
      />
      <div class="install-dialog__actions">
        <button
          class="btn role-primary"
          @click="close"
        >
          Close
        </button>
      </div>
    </template>

    <!-- ── FAILED ── -->
    <template v-else-if="phase === 'failed'">
      <Banner
        color="error"
        :label="statusMessage"
      />
      <div class="install-dialog__actions">
        <button
          class="btn role-primary"
          @click="close"
        >
          Close
        </button>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.install-dialog {
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-width: 440px;

  &__title {
    margin-bottom: 20px;
  }

  &__errors {
    margin-bottom: 16px;
  }

  &__form {
    display: flex;
    flex-direction: column;
  }

  &__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
    gap: 12px;

    p {
      text-align: center;
      color: var(--body-text);
    }
  }

  &__spinner {
    font-size: 2rem;
    color: var(--primary);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }
}
</style>
