<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import Banner from '@components/Banner/Banner.vue';
import { useCreateGitConfig } from '../../queries/useGitConfigMutations';
import { GitConfigCreateRequest } from '../../models/gitconfig/ui-types';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Only admins may create global git configurations (the backend rejects a
// non-admin global create with 403). Hide the checkbox for everyone else so the
// option is never offered when it can't be used.
const isAdmin = computed(() => store.getters['epinio/isAdmin']?.() ?? false);

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

const {mutateAsync: createGitConfig, isPending: isCreatingGitConfig, isError: createGitConfigError, error: createGitConfigErrorData} = useCreateGitConfig(store, () => {
  handleSuccess();
  closeModal();
});

const isDirty = computed(() => {
  return dirtyFields.value.id ||
    dirtyFields.value.url ||
    dirtyFields.value.provider ||
    dirtyFields.value.username ||
    dirtyFields.value.password ||
    dirtyFields.value.certs ||
    dirtyFields.value.skipssl ||
    dirtyFields.value.global;
});

const dirtyFields = computed(() => {
  const fields: Partial<
    Record<keyof GitConfigCreateRequest, boolean>
  > = {};

  fields.id = gitConfigId.value !== '';
  fields.url = gitConfigUrl.value !== '';
  fields.provider = gitConfigProvider.value !== '';
  fields.username = gitConfigUsername.value !== '';
  fields.password = gitConfigPassword.value !== '';
  fields.certs = gitConfigCerts.value !== '';
  fields.skipssl = gitConfigSkipSSL.value !== false;
  fields.global = gitConfigGlobal.value !== false;

  return fields;
});

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

const buildCreateRequest = (): GitConfigCreateRequest => {
  const request: GitConfigCreateRequest = {
    id: gitConfigId.value,
    provider: gitConfigProvider.value,
  };
  if (gitConfigUrl.value) {
    request.url = canonicalInstanceUrl(gitConfigUrl.value);
  }
  if (gitConfigUsername.value) {
    request.username = gitConfigUsername.value;
  }
  if (gitConfigPassword.value) {
    request.password = gitConfigPassword.value;
  }
  if (gitConfigCerts.value) {
    request.certs = gitConfigCerts.value;
  }
  if (gitConfigSkipSSL.value) {
    request.skipssl = gitConfigSkipSSL.value;
  }
  if (gitConfigGlobal.value) {
    request.global = gitConfigGlobal.value;
  }
  return request;
};

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || isCreatingGitConfig.value) return;

  const request = buildCreateRequest();
  await createGitConfig({ request });

}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

const handleSuccess = () => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.gitConfigs.create.success.title`),
    message: t(`epinio.growl.gitConfigs.create.success.message`, { name: gitConfigId.value }),
  });
};

defineExpose({ openCreate });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    title="Git Configuration"
    subtitle="Create New"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
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
        <trailhand-form-row v-if="gitConfigProvider === 'github_enterprise_cloud' || gitConfigProvider === 'github_enterprise_self_hosted' || gitConfigProvider === 'gitlab_enterprise' || gitConfigProvider === 'git'" columns="1">
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
        <trailhand-form-row v-if="isAdmin" columns="1">
          <trailhand-checkbox
            :checked="gitConfigGlobal"
            @checkbox-change="(e: CustomEvent) => { gitConfigGlobal = e.detail.checked; }"
          >Global Configuration</trailhand-checkbox>
        </trailhand-form-row>
      </trailhand-form-card>

      <Banner
        v-if="createGitConfigError"
        color="error"
        :label="createGitConfigErrorData?.message || t('epinio.gitConfigs.errors.save')"
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
          {{ (isCreatingGitConfig ? t('generic.creating') : t('generic.create')) }}
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
