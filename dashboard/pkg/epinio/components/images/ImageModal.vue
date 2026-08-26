<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { validateKubernetesName } from '@shell/utils/validators/kubernetes-name';
import Banner from '@components/Banner/Banner.vue';
import { BuilderImage, BuilderImageCreateRequest, BuilderImageUpdateRequest } from '../../models/builderimage/ui-types';
import { useUpdateBuilderImage, useCreateBuilderImage } from '../../queries/useBuilderImagesMutations';

const store = useStore() as any;
const t = store.getters['i18n/t'];

// Modal open state
const showModal = ref(false);
const modalMode = ref<'create' | 'edit' | 'view'>('create');

const initialValues = ref<BuilderImage | null>(null);

// Form fields (separate from the model to avoid proxy mutation issues)
const imageName = ref('');
const imageShortDescription = ref('');
const imageDescription = ref('');
const builderImage = ref('');

const saving = ref(false);
const errors = ref<string[]>([]);

const isEdit = computed(() => modalMode.value === 'edit');
const isView = computed(() => modalMode.value === 'view');

const {mutateAsync: createBuilderImage, isPending: isCreatingBuilderImage, isError: createBuilderImageError, error: createBuilderImageErrorData} = useCreateBuilderImage(store, () => {
  handleSuccess('create');
  closeModal();
});
const {mutateAsync: updateBuilderImage, isPending: isUpdatingBuilderImage, isError: updateBuilderImageError, error: updateBuilderImageErrorData} = useUpdateBuilderImage(store, () => {
  handleSuccess('update');
  closeModal();
});

const isDirty = computed(() => {
  return dirtyFields.value.name ||
    dirtyFields.value.shortDescription ||
    dirtyFields.value.description ||
    dirtyFields.value.image
});

const dirtyFields = computed(() => {
  const fields: Partial<
    Record<keyof BuilderImageCreateRequest, boolean>
  > = {};
      
  fields.name = imageName.value !== (initialValues.value?.meta.name || '');
  fields.shortDescription = imageShortDescription.value !== (initialValues.value?.shortDescription || '');
  fields.description = imageDescription.value !== (initialValues.value?.description || '');
  fields.image = builderImage.value !== (initialValues.value?.image || '');

  return fields;
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

function openEdit(row: BuilderImage) {
  errors.value = [];
  modalMode.value = 'edit';
  initialValues.value = row;
  imageName.value = row.meta.name || '';
  imageShortDescription.value = row.shortDescription || '';
  imageDescription.value = row.description || '';
  builderImage.value = row.image || '';
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
}

const buildCreateRequest = (): BuilderImageCreateRequest => {
  const request: BuilderImageCreateRequest = {
    name: imageName.value,
    shortDescription: imageShortDescription.value,
    description: imageDescription.value,
    image: builderImage.value,
  };
  return request;
};

const buildUpdateRequest = (): BuilderImageUpdateRequest => {
  const request: BuilderImageUpdateRequest = {};

  if (dirtyFields.value.name) {
    request.name = imageName.value;
  }

  if (dirtyFields.value.description) {
    request.description = imageDescription.value;
  }

  if (dirtyFields.value.shortDescription) {
    request.shortDescription = imageShortDescription.value;
  }

  if (dirtyFields.value.image) {
    request.image = builderImage.value;
  }

  return request;
};

async function onSubmit() {
  if (!validationPassed.value || !isDirty.value || isCreatingBuilderImage.value || isUpdatingBuilderImage.value) return;

  if (isEdit.value && initialValues.value) {
    const request = buildUpdateRequest();
    await updateBuilderImage({ name: initialValues.value.meta.name, request });
  } else {
    const request = buildCreateRequest();
    await createBuilderImage({ request });
  }
}

const handleSuccess = (type: 'create' | 'update') => {
  store.dispatch('growl/success', {
    title:   t(`epinio.growl.builderImages.${type}.success.title`),
    message: t(`epinio.growl.builderImages.${type}.success.message`, { name: imageName.value }),
  });
};

defineExpose({ openCreate, openEdit });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    :dismissible.prop="false"
    :title="(isView || isEdit) ? imageName || 'Builder Image' : 'Builder Image'"
    :subtitle="(isView || isEdit) ? '' : 'Create New'"
    position="top"
    @modal-close="handleModalClose"
  >
    <div id="modal-container-element" class="modal-content">
      <trailhand-form-card>
        <Banner v-if="initialValues?.boundApps" color="warning" label="This image is currently associated with one or more applications. Editing it may cause issues for future rebuilds." />
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
        v-if="createBuilderImageError || updateBuilderImageError"
        color="error"
        :label="createBuilderImageErrorData?.message || updateBuilderImageErrorData?.message || t('epinio.builderImages.errors.save')"
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
          {{ isEdit ? (isUpdatingBuilderImage ? t('generic.updating') : t('generic.save')) : (isCreatingBuilderImage ? t('generic.creating') : t('generic.create')) }}
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
