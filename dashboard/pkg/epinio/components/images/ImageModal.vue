<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';

import { EPINIO_TYPES } from '../../types';
import { epinioExceptionToErrorsArray } from '../../utils/errors';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import { objValuesToString } from '../../utils/settings';
import Banner from '@components/Banner/Banner.vue';
import EpinioBuilderImageModel from '../../models/builderimages';

import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<EpinioBuilderImageModel | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const imageName = ref('');
const imageShortDescription = ref('');
const imageDescription = ref('');
const builderImage = ref('');

const saving = ref(false);
const errors = ref<string[]>([]);
const hasAssociatedApps = ref<boolean>(false);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const isDirty = computed(() => {
  if (!initialValues.value) {
    return imageName.value !== '' ||
      imageShortDescription.value !== '' ||
      imageDescription.value !== '' ||
      builderImage.value !== '';
  }

  const isDirty = imageName.value !== (initialValues.value!.meta.name || '') ||
    imageShortDescription.value !== (initialValues.value!.short_description || '') ||
    imageDescription.value !== (initialValues.value!.description || '') ||
    builderImage.value !== (initialValues.value!.image || '');

  return isDirty;
});

const showDiscardConfirm = ref(false);

const validationPassed = computed(() => {
  if (!imageName.value) return false;
  if (!imageShortDescription.value) return false;
  if (!imageDescription.value) return false;
  if (!builderImage.value) return false;

  const nameErrors = validateKubernetesName(imageName.value, '', store.getters, undefined, []);
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
  imageName.value = '';
  imageShortDescription.value = '';
  imageDescription.value = '';
  builderImage.value = '';
  showModal.value = true;
}

function openView(row: EpinioBuilderImageModel) {
  errors.value = [];
  modalMode.value = 'view';
  imageName.value = row.name || row.meta?.name || '';
  imageShortDescription.value = row.short_description || '';
  imageDescription.value = row.description || '';
  builderImage.value = row.image || '';
  hasAssociatedApps.value = !!row.boundApps;
  showModal.value = true;
}

function openEdit(row: EpinioBuilderImageModel) {
  errors.value = [];
  modalMode.value = 'edit';
  initialValues.value = row;
  imageName.value = row.name || row.meta?.name || '';
  imageShortDescription.value = row.short_description || '';
  imageDescription.value = row.description || '';
  builderImage.value = row.image || '';
  hasAssociatedApps.value = !!row.boundApps;
  showModal.value = true;
}

function handleModalClose() {
  if (isDirty.value) {
    showDiscardConfirm.value = true;
  } else {
    closeModal();
  }
}

function handleKeepEditing() {
  showDiscardConfirm.value = false;
}

function handleDiscard() {
  showDiscardConfirm.value = false;
  closeModal();
}

function closeModal() {
  // Clear form state before setting showModal = false so that when Lit fires
  // modal-close (which triggers handleModalClose), isDirty is already false
  imageName.value = '';
  imageShortDescription.value = '';
  imageDescription.value = '';
  builderImage.value = '';
  errors.value = [];
  showDiscardConfirm.value = false;
  showModal.value = false;
  initialValues.value = null;
  hasAssociatedApps.value = false;
}

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || saving.value) return;

  saving.value = true;
  errors.value = [];

  try {
    if (isEdit.value && initialValues.value) {
      const image = initialValues.value;

      image.description       = imageDescription.value;
      image.short_description = imageShortDescription.value;
      image.image             = builderImage.value;

      await image.update();
      store.dispatch('growl/success', {
        title:   t('epinio.growl.builderImages.update.success.title'),
        message: t('epinio.growl.builderImages.update.success.message', { name: imageName.value }),
      });
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.BUILDER_IMAGE, opt: { force: true } }).catch(() => {});
    } else {
      const image = await store.dispatch('epinio/create', { type: EPINIO_TYPES.BUILDER_IMAGE });

      image.metadata          = { name: imageName.value };
      image.description       = imageDescription.value;
      image.short_description = imageShortDescription.value;
      image.image             = builderImage.value;

      await image.create();
      store.dispatch('growl/success', {
        title:   t('epinio.growl.builderImages.create.success.title'),
        message: t('epinio.growl.builderImages.create.success.message', { name: imageName.value }),
      });
      closeModal();
      store.dispatch('epinio/findAll', { type: EPINIO_TYPES.BUILDER_IMAGE, opt: { force: true } }).catch(() => {});
    }
  } catch (err: any) {
    errors.value = epinioExceptionToErrorsArray(err);
    store.dispatch('growl/error', {
      title: isEdit.value
        ? t('epinio.growl.builderImages.save.error.updateTitle')
        : t('epinio.growl.builderImages.save.error.createTitle'),
      message: t('epinio.growl.builderImages.save.error.message'),
    });
    console.error('Error saving image:', err);
  } finally {
    saving.value = false;
  }
}

defineExpose({ openCreate, openEdit, openView });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? initialValues.meta?.name || 'Builder Image' : 'Builder Image'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    @modal-close="handleModalClose"
    position="top"
  >
    <div class="modal-content" id="modal-container-element">
      <trailhand-form-card>
        <Banner v-if="hasAssociatedApps" color="warning" label="This image is currently associated with one or more applications. Editing it may cause issues for future rebuilds." />
        <trailhand-form-row columns="2">
          <trailhand-text-input
            :value="imageName"
            label="Name"
            placeholder="A Unique Name"
            :required="true"
            :disabled="isView || isEdit"
            @text-input-change="(e: CustomEvent) => { imageName = e.detail.value; }"
          ></trailhand-text-input>
          <trailhand-text-input
            :value="imageShortDescription"
            label="Short Description"
            placeholder="A brief description"
            :required="true"
            :disabled="isView"
            @text-input-change="(e: CustomEvent) => { imageShortDescription = e.detail.value; }"
          ></trailhand-text-input>
        </trailhand-form-row>
        <trailhand-form-row>
          <trailhand-text-area
            :value="imageDescription"
            label="Description"
            placeholder="A detailed description"
            :disabled="isView"
            required
            @text-area-change="(e: CustomEvent) => { imageDescription = e.detail.value; }"
          ></trailhand-text-area>
        </trailhand-form-row>
        <trailhand-form-row columns="1">
          <trailhand-text-input
            :value="builderImage"
            label="Image"
            placeholder="e.g. registry.example.com/builder:latest"
            :disabled="isView"
            required
            @text-input-change="(e: CustomEvent) => { builderImage = e.detail.value; }"
          ></trailhand-text-input>
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
      <template v-if="isView">
        <trailhand-button
          variant="secondary"
          class="mr-10"
          @button-click="closeModal"
        >
          Close
        </trailhand-button>
        <trailhand-button
          variant="primary"
          @button-click="modalMode = 'edit'"
        >
          Edit Configuration
        </trailhand-button>
      </template>
      <template v-else-if="showDiscardConfirm">
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
          {{ saving ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? t('generic.save') : t('generic.create')) }}
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
