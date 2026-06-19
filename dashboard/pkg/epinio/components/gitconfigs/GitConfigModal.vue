<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

// Form fields (separate from the model to avoid proxy mutation issues)
const gitConfigId = ref('');
const gitConfigUrl = ref('');
const gitConfigProvider = ref('');
const gitConfigUserOrg = ref('');
const gitConfigRepo = ref('');
const gitConfigUsername = ref('');
const gitConfigPassword = ref('');
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
  label: 'GitHub Enterprise',
  value: 'github_enterprise'
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
        gitConfigUserOrg.value !== '' ||
        gitConfigRepo.value !== '' ||
        gitConfigUsername.value !== '' ||
        gitConfigPassword.value !== '' ||
        gitConfigSkipSSL.value !== false ||
        gitConfigGlobal.value !== false;
    }
);

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!gitConfigId.value) return false;
  if (!gitConfigUrl.value) return false;
  if (!gitConfigProvider.value) return false;
  if (!gitConfigUserOrg.value) return false;
  if (!gitConfigRepo.value) return false;

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
  gitConfigUserOrg.value = '';
  gitConfigRepo.value = '';
  gitConfigUsername.value = '';
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
  gitConfigUserOrg.value = '';
  gitConfigRepo.value = '';
  gitConfigUsername.value = '';
  gitConfigPassword.value = '';
  gitConfigSkipSSL.value = false;
  gitConfigGlobal.value = false;
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  hasAssociatedApps.value = false;
}

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  try {
    const gitConfig = await store.dispatch('epinio/create', { type: EPINIO_TYPES.GIT_CONFIG });

    gitConfig.id                = gitConfigId.value;
    gitConfig.url               = gitConfigUrl.value;
    gitConfig.provider          = gitConfigProvider.value;
    gitConfig.userOrg           = gitConfigUserOrg.value;
    gitConfig.repo              = gitConfigRepo.value;
    gitConfig.username          = gitConfigUsername.value;
    gitConfig.password          = gitConfigPassword.value;
    gitConfig.skipSSL           = gitConfigSkipSSL.value;
    gitConfig.global            = gitConfigGlobal.value;

    await gitConfig.create();
    closeModal();
    store.dispatch('epinio/findAll', { type: EPINIO_TYPES.GIT_CONFIG, opt: { force: true } }).catch(() => {});
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err, t);
    console.error('Error saving git configuration:', err);
  } finally {
    saving.value = false;
  }
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
          <trailhand-text-input
            :value="gitConfigUrl"
            label="URL"
            placeholder="Git Host URL"
            :required="true"
            @text-input-change="(e: CustomEvent) => { gitConfigUrl = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row columns="3">
          <trailhand-dropdown
            :value="gitConfigProvider"
            label="Provider"
            placeholder="Git Provider (e.g. github, gitlab, etc.)"
            :options="providerOptions"
            :required="true"
            @dropdown-change="(e: CustomEvent) => { gitConfigProvider = e.detail.value; }"
          ></trailhand-dropdown>
          <trailhand-text-input
            :value="gitConfigUserOrg"
            label="User/Organization"
            placeholder="Git User or Organization Name"
            :required="true"
            @text-input-change="(e: CustomEvent) => { gitConfigUserOrg = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
              :value="gitConfigRepo"
              label="Repository"
              placeholder="Git Repository Name"
              :required="true"
              @text-input-change="(e: CustomEvent) => { gitConfigRepo = e.detail.value; }"
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
        <trailhand-form-row columns="2">
          <trailhand-checkbox
            :value="gitConfigSkipSSL"
            @checkbox-change="(e: CustomEvent) => { gitConfigSkipSSL = e.detail.value; }"
          >Skip SSL Verification</trailhand-checkbox>
          <trailhand-checkbox
            :value="gitConfigGlobal"
            @checkbox-change="(e: CustomEvent) => { gitConfigGlobal = e.detail.value; }"
          >Global Configuration</trailhand-checkbox>
        </trailhand-form-row>
      </trailhand-form-card>
    </div>

    <div slot="footer">
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
</style>
