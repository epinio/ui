<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import Banner from '@components/Banner/Banner.vue';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

// Form fields (separate from the model to avoid proxy mutation issues)
const gitConfigId = ref('');
const gitConfigUrl = ref('');
const gitConfigProvider = ref('');
const gitConfigUsername = ref('');
const gitConfigPassword = ref('');
const gitConfigCerts = ref('');
const gitConfigSkipSSL = ref(false);
const gitConfigGlobal = ref(false);

const saving = ref(false);
const errors = ref<string[]>([]);
const hasAssociatedApps = ref<boolean>(false);

const providerOptions = [{
  label: 'Git',
  value: 'git'
}, {
  label: 'GitHub',
  value: 'github'
}, {
  label: 'GitHub Enterprise Cloud',
  value: 'github_enterprise_cloud'
}, {
  label: 'GitHub Enterprise Self-Hosted',
  value: 'github_enterprise_self_hosted'
}, {
  label: 'GitLab',
  value: 'gitlab'
}, {
  label: "GitLab Enterprise",
  value: "gitlab_enterprise"
}];

const isDirty = computed(() => {
    return gitConfigId.value !== '' ||
        gitConfigUrl.value !== '' ||
        gitConfigProvider.value !== '' ||
        gitConfigUsername.value !== '' ||
        gitConfigPassword.value !== '' ||
        gitConfigCerts.value !== '' ||
        gitConfigSkipSSL.value !== false ||
        gitConfigGlobal.value !== false;
    }
);

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!gitConfigId.value) return false;
  if (!gitConfigProvider.value) return false;
  if (!gitConfigUrl.value && (gitConfigProvider.value === 'github_enterprise_cloud' || gitConfigProvider.value === 'github_enterprise_self_hosted' || gitConfigProvider.value === 'gitlab_enterprise' || gitConfigProvider.value === 'git')) return false;

  const nameErrors = validateKubernetesName(gitConfigId.value, '', store.getters, undefined, []);
  return nameErrors.length === 0;
});

const canSave = computed(() => {
  const dirty = isDirty.value;
  const valid = validationPassed.value;
  return dirty && valid && !saving.value;
});

function openCreate() {
  errors.value = [];
  modalMode.value = 'create';
  gitConfigId.value = '';
  gitConfigUrl.value = '';
  gitConfigProvider.value = '';
  gitConfigUsername.value = '';
  gitConfigCerts.value = '';
  gitConfigPassword.value = '';
  gitConfigSkipSSL.value = false;
  gitConfigGlobal.value = false;
  showModal.value = true;
}

function handleModalClose() {
  if (isDirty.value) {
    showDiscardConfirm.value = true;
  } else {
    closeModal();
  }
}

function closeModal() {
  // Clear form state before setting showModal = false so that when Lit fires
  // modal-close (which triggers handleModalClose), isDirty is already false
  gitConfigId.value = '';
  gitConfigUrl.value = '';
  gitConfigProvider.value = '';
  gitConfigUsername.value = '';
  gitConfigPassword.value = '';
  gitConfigCerts.value = '';
  gitConfigSkipSSL.value = false;
  gitConfigGlobal.value = false;
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  hasAssociatedApps.value = false;
}

// canonicalInstanceUrl normalizes an enterprise instance URL to `https://<host>`
// (scheme + host, no path or trailing slash). The server matches a git config to
// a repository by reducing the repo URL to scheme://host, so the stored config
// URL must be in that same shape. Empty input (SaaS providers) is left empty.
function canonicalInstanceUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed;
  }
}

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  try {
    const gitConfig = await store.dispatch('epinio/create', { type: EPINIO_TYPES.GIT_CONFIG });

    gitConfig.id                = gitConfigId.value;
    gitConfig.url               = canonicalInstanceUrl(gitConfigUrl.value);
    gitConfig.provider          = gitConfigProvider.value;
    gitConfig.username          = gitConfigUsername.value;
    gitConfig.password          = gitConfigPassword.value;
    gitConfig.certs             = gitConfigCerts.value;
    gitConfig.skipssl           = gitConfigSkipSSL.value;
    gitConfig.global            = gitConfigGlobal.value;

    await gitConfig.create();
    store.dispatch('growl/success', {
        title:   t('epinio.growl.gitConfigs.create.success.title'),
        message: t('epinio.growl.gitConfigs.create.success.message', { name: gitConfigId.value }),
      });
    closeModal();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.GIT_CONFIG, opt: { force: true } }).catch(() => {});
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
    store.dispatch('growl/error', {
      title: t('epinio.growl.gitConfigs.save.error.createTitle'),
      message: t('epinio.growl.gitConfigs.save.error.message'),
    });
    console.error('Error saving git configuration:', err);
  } finally {
    saving.value = false;
  }
}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

defineExpose({ openCreate });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    title="Git Configuration"
    subtitle="Create New"
    @modal-close="handleModalClose"
    position="top"
  >
    <div class="modal-content" id="modal-container-element">
      <trailhand-form-card>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="gitConfigId"
            label="Id"
            placeholder="A Unique Identifier"
            :required="true"
            @text-input-change="(e: CustomEvent) => { gitConfigId = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-dropdown
            :value="gitConfigProvider"
            label="Provider"
            placeholder="Git Provider (e.g. github, gitlab, etc.)"
            :options="providerOptions"
            :required="true"
            @dropdown-change="(e: CustomEvent) => { gitConfigProvider = e.detail.value; }"
          ></trailhand-dropdown>
        </trailhand-form-row>
        <trailhand-form-row columns="1" v-if="gitConfigProvider === 'github_enterprise_cloud' || gitConfigProvider === 'github_enterprise_self_hosted' || gitConfigProvider === 'gitlab_enterprise' || gitConfigProvider === 'git'">
          <trailhand-text-input
            :value="gitConfigUrl"
            label="URL"
            placeholder="Git Host URL"
            :required="true"
            @text-input-change="(e: CustomEvent) => { gitConfigUrl = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="gitConfigUsername"
            label="Username"
            placeholder="Git Username"
            @text-input-change="(e: CustomEvent) => { gitConfigUsername = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="gitConfigPassword"
            label="Password/Token"
            placeholder="Git Password or Personal Access Token"
            type="password"
            @text-input-change="(e: CustomEvent) => { gitConfigPassword = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row>
          <trailhand-text-area
            :value="gitConfigCerts"
            label="Certificate"
            placeholder="Git Certificate"
            @text-area-change="(e: CustomEvent) => { gitConfigCerts = e.detail.value; }"
          ></trailhand-text-area>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-checkbox
            :checked="gitConfigSkipSSL"
            @checkbox-change="(e: CustomEvent) => { gitConfigSkipSSL = e.detail.checked; }"
          >Skip SSL Verification</trailhand-checkbox>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-checkbox
            :checked="gitConfigGlobal"
            @checkbox-change="(e: CustomEvent) => { gitConfigGlobal = e.detail.checked; }"
          >Global Configuration</trailhand-checkbox>
        </trailhand-form-row>
      </trailhand-form-card>

      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>

    <div slot="footer">
      <template v-if="showDiscardConfirm">
        <span class="discard-message">You have unsaved changes.</span>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleKeepEditing"
        >
          Keep Editing
        </trailhand-button>
        <trailhand-button
          variant="destructive"
          @button-click="handleDiscard"
        >
          Discard
        </trailhand-button>
      </template>
      <template v-else>
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="handleModalClose"
        >
          Cancel
        </trailhand-button>
        <trailhand-button
          variant="primary"
          :disabled="!canSave"
          @button-click="onSubmit"
        >
          Create
        </trailhand-button>
      </template>
      
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 1000px;
  min-height: 350px;
}

.discard-message {
  font-size: 13px;
  color: var(--body-text);
  margin-right: 12px;
}
</style>
