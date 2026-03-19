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

// ── constants ──────────────────────────────────────────────────────────────
const OPERATOR_NAMESPACE  = 'epinio-system';
const OPERATOR_IMAGE      = 'ghcr.io/epinio/install-operator:latest';
const OPERATOR_DEPLOYMENT = 'install-operator-controller-manager';
const OPERATOR_SA         = 'controller-manager';
const CR_GROUP            = 'epinio.apps.example.com';
const CR_VERSION          = 'v1alpha1';
const CR_PLURAL           = 'installepinios';

// ── form state ─────────────────────────────────────────────────────────────
const domain          = ref('');
const targetNamespace = ref('epinio');
const version         = ref('');

// ── page state ─────────────────────────────────────────────────────────────
type Phase = 'form' | 'bootstrapping' | 'polling' | 'done' | 'failed';
const phase         = ref<Phase>('form');
const busy          = ref(false);
const errors        = ref<string[]>([]);
const bootstrapStep = ref('');

// ── steps list for bootstrapping UI ────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'done' | 'skipped';
interface BootstrapStep { label: string; status: StepStatus }
const bootstrapSteps = ref<BootstrapStep[]>([]);

// ── installed CR identity (for polling) ────────────────────────────────────
const crName        = ref('');
const statusMessage = ref('');

// ── polling ────────────────────────────────────────────────────────────────
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollCount = 0;
const POLL_MAX = 90; // 90 × 4 s = 6 min max wait for operator

onUnmounted(() => stopPolling());

function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
const cid = () => props.cluster.id;

function rawUrl(path: string) {
  return `/k8s/clusters/${ cid() }${ path }`;
}

function crUrl(name = '') {
  const base = rawUrl(`/apis/${ CR_GROUP }/${ CR_VERSION }/namespaces/${ OPERATOR_NAMESPACE }/${ CR_PLURAL }`);

  return name ? `${ base }/${ name }` : base;
}

async function k8sRequest(opt: Record<string, any>) {
  return store.dispatch('cluster/request', opt, { root: true });
}

function extractErrorMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?._status) {
    const body = err?.message || err?.reason || err?._statusText;

    if (body) return `${ err._status }: ${ body }`;

    return `Request failed with status ${ err._status }`;
  }
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return 'An unknown error occurred';
  }
}

async function applyResource(url: string, data: any): Promise<void> {
  try {
    await k8sRequest({ url, method: 'post', headers: { 'content-type': 'application/json' }, data });
  } catch (err: any) {
    const status = err?._status || err?.response?.status;

    if (status !== 409) throw err; // surface all non-conflict errors (including 422 validation)

    // 409 = resource already exists → patch it so stale resources get updated
    const name = data?.metadata?.name;

    if (!name) return;
    try {
      await k8sRequest({
        url:     `${ url }/${ name }`,
        method:  'patch',
        headers: { 'content-type': 'application/strategic-merge-patch+json' },
        data,
      });
    } catch {
      // patch failed - resource is there, close enough
    }
  }
}

function setStep(label: string) {
  bootstrapStep.value = label;
  const step = bootstrapSteps.value.find((s) => s.label === label);

  if (step) step.status = 'running';
}

function completeStep(label: string, skipped = false) {
  const step = bootstrapSteps.value.find((s) => s.label === label);

  if (step) step.status = skipped ? 'skipped' : 'done';
}

// ── operator bootstrap ─────────────────────────────────────────────────────
async function isOperatorDeployed(): Promise<boolean> {
  try {
    const dep = await k8sRequest({ url: rawUrl(`/apis/apps/v1/namespaces/${ OPERATOR_NAMESPACE }/deployments/${ OPERATOR_DEPLOYMENT }`) });

    // Only consider it "deployed" if at least one replica is ready
    return (dep?.status?.readyReplicas ?? 0) >= 1;
  } catch {
    return false;
  }
}

async function bootstrapOperator(): Promise<void> {
  phase.value = 'bootstrapping';

  const steps = [
    'Check operator',
    'Create namespace',
    'Register CRD',
    'Create ServiceAccount',
    'Configure RBAC',
    'Deploy operator',
    'Wait for operator',
  ];

  bootstrapSteps.value = steps.map((label) => ({ label, status: 'pending' as StepStatus }));

  // 1 ── check if already deployed
  setStep('Check operator');
  const deployed = await isOperatorDeployed();

  completeStep('Check operator');
  if (deployed) {
    for (const s of bootstrapSteps.value) {
      if (s.status === 'pending') s.status = 'skipped';
    }
    bootstrapStep.value = 'Operator already running — proceeding…';
    return;
  }

  // 2 ── namespace
  setStep('Create namespace');
  await ensureOperatorNamespace();
  completeStep('Create namespace');

  // 3 ── CRD
  setStep('Register CRD');
  await applyResource(
    rawUrl('/apis/apiextensions.k8s.io/v1/customresourcedefinitions'),
    {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind:       'CustomResourceDefinition',
      metadata:   { name: 'installepinios.epinio.apps.example.com' },
      spec:       {
        group: CR_GROUP,
        names: {
          kind:     'InstallEpinio',
          listKind: 'InstallEpinioList',
          plural:   CR_PLURAL,
          singular: 'installepinio',
        },
        scope:    'Namespaced',
        versions: [{
          name:    CR_VERSION,
          served:  true,
          storage: true,
          subresources: { status: {} },
          schema:  {
            openAPIV3Schema: {
              type: 'object',
              required: ['spec'],
              properties: {
                apiVersion: { type: 'string' },
                kind:       { type: 'string' },
                metadata:   { type: 'object' },
                spec: {
                  type: 'object',
                  properties: {
                    domain:          { type: 'string' },
                    targetNamespace: { type: 'string' },
                    version:         { type: 'string' },
                    imagePullSecret:          { type: 'string' },
                    imageRegistry:            { type: 'string' },
                    imageRegistryUsername:    { type: 'string' },
                    imageRegistryPassword:    { type: 'string' },
                  },
                },
                status: {
                  type: 'object',
                  properties: {
                    lastUpdateTime: { type: 'string', format: 'date-time' },
                    conditions: {
                      type:  'array',
                      'x-kubernetes-list-type':     'map',
                      'x-kubernetes-list-map-keys': ['type'],
                      items: {
                        type:     'object',
                        required: ['lastTransitionTime', 'message', 'reason', 'status', 'type'],
                        properties: {
                          lastTransitionTime: { type: 'string', format: 'date-time' },
                          message:            { type: 'string', maxLength: 32768 },
                          observedGeneration: { type: 'integer', minimum: 0 },
                          reason:             { type: 'string', minLength: 1, maxLength: 1024 },
                          status:             { type: 'string', enum: ['True', 'False', 'Unknown'] },
                          type:               { type: 'string', maxLength: 316 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }],
      },
    }
  );
  completeStep('Register CRD');

  // 4 ── ServiceAccount
  setStep('Create ServiceAccount');
  await applyResource(
    rawUrl(`/api/v1/namespaces/${ OPERATOR_NAMESPACE }/serviceaccounts`),
    { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: OPERATOR_SA, namespace: OPERATOR_NAMESPACE } }
  );
  completeStep('Create ServiceAccount');

  // 5 ── RBAC
  setStep('Configure RBAC');
  // Manager ClusterRole
  await applyResource(
    rawUrl('/apis/rbac.authorization.k8s.io/v1/clusterroles'),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'ClusterRole',
      metadata:   { name: 'install-operator-manager-role' },
      rules:      [
        { apiGroups: [''], resources: ['configmaps', 'namespaces'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        { apiGroups: ['batch'], resources: ['jobs'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        { apiGroups: [CR_GROUP], resources: [CR_PLURAL], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        { apiGroups: [CR_GROUP], resources: [`${ CR_PLURAL }/finalizers`], verbs: ['update'] },
        { apiGroups: [CR_GROUP], resources: [`${ CR_PLURAL }/status`], verbs: ['get', 'patch', 'update'] },
      ],
    }
  );
  // Manager ClusterRoleBinding
  await applyResource(
    rawUrl('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings'),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'ClusterRoleBinding',
      metadata:   { name: 'install-operator-manager-rolebinding' },
      roleRef:    { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'install-operator-manager-role' },
      subjects:   [{ kind: 'ServiceAccount', name: OPERATOR_SA, namespace: OPERATOR_NAMESPACE }],
    }
  );
  // Installer ClusterRole (broad permissions so the Job can run Helm)
  // escalate + bind verbs are required to create ClusterRoles that grant
  // permissions the SA holds (e.g. Epinio's "reflector" ClusterRole).
  await applyResource(
    rawUrl('/apis/rbac.authorization.k8s.io/v1/clusterroles'),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'ClusterRole',
      metadata:   { name: 'install-operator-installer-role' },
      rules:      [
        { apiGroups: ['*'], resources: ['*'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        {
          apiGroups: ['rbac.authorization.k8s.io'],
          resources: ['clusterroles', 'clusterrolebindings', 'roles', 'rolebindings'],
          verbs:     ['escalate', 'bind', 'get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
        },
      ],
    }
  );
  // Installer ClusterRoleBinding
  await applyResource(
    rawUrl('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings'),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'ClusterRoleBinding',
      metadata:   { name: 'install-operator-installer-rolebinding' },
      roleRef:    { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'install-operator-installer-role' },
      subjects:   [{ kind: 'ServiceAccount', name: OPERATOR_SA, namespace: OPERATOR_NAMESPACE }],
    }
  );
  // Leader-election Role + Binding
  await applyResource(
    rawUrl(`/apis/rbac.authorization.k8s.io/v1/namespaces/${ OPERATOR_NAMESPACE }/roles`),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'Role',
      metadata:   { name: 'install-operator-leader-election-role', namespace: OPERATOR_NAMESPACE },
      rules:      [
        { apiGroups: [''], resources: ['configmaps'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        { apiGroups: ['coordination.k8s.io'], resources: ['leases'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
        { apiGroups: [''], resources: ['events'], verbs: ['create', 'patch'] },
      ],
    }
  );
  await applyResource(
    rawUrl(`/apis/rbac.authorization.k8s.io/v1/namespaces/${ OPERATOR_NAMESPACE }/rolebindings`),
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind:       'RoleBinding',
      metadata:   { name: 'install-operator-leader-election-rolebinding', namespace: OPERATOR_NAMESPACE },
      roleRef:    { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'install-operator-leader-election-role' },
      subjects:   [{ kind: 'ServiceAccount', name: OPERATOR_SA, namespace: OPERATOR_NAMESPACE }],
    }
  );
  completeStep('Configure RBAC');

  // 6 ── Deployment
  setStep('Deploy operator');
  await applyResource(
    rawUrl(`/apis/apps/v1/namespaces/${ OPERATOR_NAMESPACE }/deployments`),
    {
      apiVersion: 'apps/v1',
      kind:       'Deployment',
      metadata:   {
        name:      OPERATOR_DEPLOYMENT,
        namespace: OPERATOR_NAMESPACE,
        labels:    { 'control-plane': 'controller-manager', 'app.kubernetes.io/name': 'epinio' },
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { 'control-plane': 'controller-manager', 'app.kubernetes.io/name': 'epinio' } },
        template: {
          metadata: { labels: { 'control-plane': 'controller-manager', 'app.kubernetes.io/name': 'epinio' } },
          spec:     {
            serviceAccountName:            OPERATOR_SA,
            terminationGracePeriodSeconds: 10,
            containers: [{
              name:            'manager',
              image:           OPERATOR_IMAGE,
              imagePullPolicy: 'Always',
              command:         ['/manager'],
              args:            [
                '--health-probe-bind-address=:8081',
                '--ui-bind-address=:8082',
                '--installer-helm-image=alpine/helm:3.18',
              ],
              env: [
                { name: 'POD_NAMESPACE', valueFrom: { fieldRef: { fieldPath: 'metadata.namespace' } } },
                { name: 'POD_SERVICE_ACCOUNT', valueFrom: { fieldRef: { fieldPath: 'spec.serviceAccountName' } } },
              ],
              ports: [{ containerPort: 8082, name: 'ui', protocol: 'TCP' }],
              livenessProbe:  { httpGet: { path: '/healthz', port: 8081 }, initialDelaySeconds: 15, periodSeconds: 20 },
              readinessProbe: { httpGet: { path: '/readyz', port: 8081 }, initialDelaySeconds: 5, periodSeconds: 10 },
              resources: {
                limits:   { cpu: '500m', memory: '128Mi' },
                requests: { cpu: '10m', memory: '64Mi' },
              },
            }],
          },
        },
      },
    }
  );
  completeStep('Deploy operator');

  // 7 ── wait for pod ready
  setStep('Wait for operator');
  await waitForDeploymentReady();
  completeStep('Wait for operator');
}

async function waitForDeploymentReady(): Promise<void> {
  const url = rawUrl(`/apis/apps/v1/namespaces/${ OPERATOR_NAMESPACE }/deployments/${ OPERATOR_DEPLOYMENT }`);
  const maxAttempts = 36; // 36 × 5 s = 3 min

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const dep = await k8sRequest({ url });
      const ready = dep?.status?.readyReplicas ?? 0;

      bootstrapStep.value = `Waiting for operator pod… (${ i + 1 }/${ maxAttempts })`;
      if (ready >= 1) return;
    } catch {
      // transient - keep waiting
    }
  }
  throw new Error('Operator did not become ready within 3 minutes. Check pod logs in epinio-system.');
}

async function waitForCRDReady(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await k8sRequest({ url: crUrl() });

      return;
    } catch { /* keep waiting */ }
  }
}

// ── ensure namespace ────────────────────────────────────────────────────────
async function ensureOperatorNamespace(): Promise<void> {
  try {
    await k8sRequest({ url: rawUrl(`/api/v1/namespaces/${ OPERATOR_NAMESPACE }`) });
  } catch (err: any) {
    const status = err?._status || err?.response?.status;

    if (status === 404) {
      await k8sRequest({
        url:     rawUrl('/api/v1/namespaces'),
        method:  'post',
        headers: { 'content-type': 'application/json' },
        data:    { apiVersion: 'v1', kind: 'Namespace', metadata: { name: OPERATOR_NAMESPACE } },
      });
    } else {
      throw err;
    }
  }
}

// ── duplicate check ─────────────────────────────────────────────────────────
async function hasActiveInstall(ns: string): Promise<boolean> {
  try {
    const list  = await k8sRequest({ url: crUrl() });
    const items: any[] = list?.items ?? [];

    return items.some((item: any) => {
      if (item.spec?.targetNamespace !== ns) return false;
      const conds: any[] = item.status?.conditions ?? [];
      const available   = conds.find((c: any) => c.type === 'Available');
      const progressing = conds.find((c: any) => c.type === 'Progressing');

      return available?.status === 'True' || progressing?.status === 'True';
    });
  } catch {
    return false;
  }
}

// ── submit ──────────────────────────────────────────────────────────────────
async function install() {
  errors.value = [];
  if (!domain.value.trim())          errors.value.push('Domain is required');
  if (!targetNamespace.value.trim()) errors.value.push('Target Namespace is required');
  if (!version.value.trim())         errors.value.push('Version is required');
  if (errors.value.length) return;

  busy.value = true;
  try {
    // Step A — bootstrap operator if not present
    await bootstrapOperator();

    // Step B — wait for CRD to be served (after fresh install)
    bootstrapStep.value = 'Verifying CRD availability…';
    await waitForCRDReady();

    // Step C — duplicate guard
    const duplicate = await hasActiveInstall(targetNamespace.value.trim());

    if (duplicate) {
      errors.value = [`An install for namespace "${ targetNamespace.value.trim() }" is already in progress or completed on this cluster.`];
      phase.value  = 'form';
      return;
    }

    // Step D — create InstallEpinio CR
    const res = await k8sRequest({
      url:     crUrl(),
      method:  'post',
      headers: { 'content-type': 'application/json' },
      data:    {
        apiVersion: `${ CR_GROUP }/${ CR_VERSION }`,
        kind:       'InstallEpinio',
        metadata:   { generateName: 'install-epinio-', namespace: OPERATOR_NAMESPACE },
        spec:       {
          domain:          domain.value.trim(),
          targetNamespace: targetNamespace.value.trim(),
          version:         version.value.trim(),
        },
      },
    });

    crName.value        = res?.metadata?.name ?? '';
    statusMessage.value = 'Install request accepted — waiting for operator…';
    phase.value         = 'polling';
    pollCount           = 0;
    schedulePoll();
  } catch (err: any) {
    errors.value = [extractErrorMessage(err)];
    phase.value  = 'form';
  } finally {
    busy.value = false;
  }
}

// ── polling loop ────────────────────────────────────────────────────────────
function schedulePoll(delayMs = 4000) {
  pollCount++;
  if (pollCount > POLL_MAX) {
    statusMessage.value = 'Timed out waiting for the operator to start. The operator pod may have failed to pull its image or start. Check: kubectl get pods -n epinio-system';
    phase.value = 'failed';
    stopPolling();
    return;
  }
  pollTimer = setTimeout(poll, delayMs);
}

async function poll() {
  if (!crName.value) return;
  try {
    const cr         = await k8sRequest({ url: crUrl(crName.value) });
    const conditions: any[] = cr?.status?.conditions ?? [];

    const available   = conditions.find((c: any) => c.type === 'Available');
    const progressing = conditions.find((c: any) => c.type === 'Progressing');
    const degraded    = conditions.find((c: any) => c.type === 'Degraded');

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
      statusMessage.value = `Waiting for operator to start… (attempt ${ pollCount }/${ POLL_MAX })`;
      schedulePoll();
    }
  } catch (err: any) {
    statusMessage.value = `Could not reach the cluster (${ extractErrorMessage(err) }) — retrying… (${ pollCount }/${ POLL_MAX })`;
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
            placeholder="e.g. epinio.192.168.49.2.nip.io"
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
            placeholder="e.g. 1.13.9"
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
            {{ busy ? 'Working…' : 'Install' }}
          </button>
        </div>
      </form>
    </template>

    <!-- ── BOOTSTRAPPING ── -->
    <template v-else-if="phase === 'bootstrapping'">
      <div class="install-dialog__steps">
        <div
          v-for="step in bootstrapSteps"
          :key="step.label"
          class="install-dialog__step"
          :class="`install-dialog__step--${ step.status }`"
        >
          <span class="install-dialog__step-icon">
            <i
              v-if="step.status === 'running'"
              class="icon icon-spinner icon-spin"
            />
            <i
              v-else-if="step.status === 'done'"
              class="icon icon-checkmark"
            />
            <i
              v-else-if="step.status === 'skipped'"
              class="icon icon-minus"
            />
            <i
              v-else
              class="icon icon-dot-open"
            />
          </span>
          <span>{{ step.label }}</span>
          <span
            v-if="step.status === 'running' && bootstrapStep"
            class="install-dialog__step-detail"
          >
            {{ bootstrapStep }}
          </span>
        </div>
      </div>
      <div class="install-dialog__actions">
        <button
          class="btn role-secondary"
          @click="close"
        >
          Close (continues in background)
        </button>
      </div>
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
  min-width: 460px;

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

  // ── bootstrap steps ──
  &__steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0 20px;
  }

  &__step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--body-text-secondary);

    &--running { color: var(--body-text); font-weight: 500; }
    &--done    { color: var(--success); }
    &--skipped { color: var(--body-text-secondary); opacity: 0.6; }
  }

  &__step-icon {
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  &__step-detail {
    font-size: 12px;
    color: var(--body-text-secondary);
    margin-left: 4px;
  }

  // ── spinner status ──
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
