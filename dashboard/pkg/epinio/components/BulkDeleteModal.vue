<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { epinioExceptionToErrorsArray } from '../utils/errors';
import Banner from '@components/Banner/Banner.vue';

const LARGE_BATCH_WARNING_THRESHOLD = 25;
const MAX_VISIBLE_NAMES = 5;

const props = withDefaults(defineProps<{
  // Singular, lowercase display label, e.g. 'application', 'service instance', 'configuration'
  resourceLabel: string;
  // EPINIO_TYPES value used to refresh the list after delete
  resourceType: string;
  // Applications only: offer an "also delete image from registry" checkbox
  showDeleteImageOption?: boolean;
  // Applications only: offer an "also delete PVCs" checkbox
  showDeletePVCOption?: boolean;
  // Services/Configurations: note that bound apps will be automatically unbound
  showUnbindNotice?: boolean;
}>(), {
  showDeleteImageOption: false,
  showDeletePVCOption:   false,
  showUnbindNotice:      false,
});

// 'deleted' fires only on success (for growl/close-modal timing).
// 'settled' always fires, success or failure: batch deletes can partially
// succeed even when they ultimately error, so consumers whose list doesn't
// refresh via the generic findAll below (e.g. Applications, which renders
// from per-namespace fetches) need a signal that fires regardless of outcome.
const emit = defineEmits(['deleted', 'settled']);

const store = useStore() as any;
const t = store.getters['i18n/t'];

const showModal = ref(false);
const itemsToDelete = ref<any[]>([]);
const deleting = ref(false);
const errors = ref<string[]>([]);
const deleteFromRegistry = ref(false);
const deletePVC = ref(false);

const names = computed(() => itemsToDelete.value.map((item) => item.meta?.name ?? item.name));
const visibleNames = computed(() => names.value.slice(0, MAX_VISIBLE_NAMES));
const remainingCount = computed(() => names.value.length - visibleNames.value.length);
const isLargeBatch = computed(() => itemsToDelete.value.length >= LARGE_BATCH_WARNING_THRESHOLD);
const resourceLabelPlural = computed(() => `${ props.resourceLabel }s`);

function openDelete(items: any[]) {
  itemsToDelete.value = items;
  errors.value = [];
  deleteFromRegistry.value = false;
  deletePVC.value = false;
  showModal.value = true;
}

function closeDelete() {
  showModal.value = false;
  itemsToDelete.value = [];
  errors.value = [];
  deleteFromRegistry.value = false;
  deletePVC.value = false;
}

async function onSubmitDelete() {
  if (!itemsToDelete.value.length) {
    return;
  }

  deleting.value = true;
  errors.value = [];
  const items = itemsToDelete.value;
  const count = items.length;
  const label = count === 1 ? props.resourceLabel : resourceLabelPlural.value;

  try {
    if (props.showDeleteImageOption && deleteFromRegistry.value) {
      items.forEach((item) => { item._deleteImage = true; });
    } else {
      items.forEach((item) => { item._deleteImage = false; });
    }

    if (props.showDeletePVCOption && deletePVC.value) {
      items.forEach((item) => { item._deletePVC = true; });
    } else {
      items.forEach((item) => { item._deletePVC = false; });
    }

    await items[0].bulkRemove(items);
    emit('deleted', items);
    closeDelete();
    store.dispatch('growl/success', {
      title:   `${ count } ${ label } Deleted`,
      message: `${ count } ${ label } successfully deleted.`,
    });
  } catch (e: any) {
    errors.value = epinioExceptionToErrorsArray(e);
    store.dispatch('growl/error', {
      title:   `${ label } Deletion Failed`,
      message: `Failed to delete one or more ${ label }. Please check the list and try again.`,
    });
  } finally {
    // A batch delete can partially succeed even when it ultimately errors,
    // so always refresh rather than only refreshing on success.
    await store.dispatch('epinio/refreshList', { type: props.resourceType });
    emit('settled', items);
    deleting.value = false;
  }
}

defineExpose({ openDelete });
</script>

<template>
  <trailhand-modal
    :open.prop="showModal"
    title="Are you sure?"
    @modal-close="closeDelete"
  >
    <div class="modal-content">
      <p>
        You are attempting to delete {{ itemsToDelete.length }} {{ itemsToDelete.length === 1 ? resourceLabel : resourceLabelPlural }}:
        <strong>{{ visibleNames.join(', ') }}</strong><span v-if="remainingCount > 0"> and {{ remainingCount }} other{{ remainingCount === 1 ? '' : 's' }}</span>.
      </p>

      <Banner
        v-if="isLargeBatch"
        color="warning"
        :label="`You're deleting ${itemsToDelete.length} ${resourceLabelPlural} — that's a lot. Make sure this is what you want.`"
      />

      <template v-if="showDeleteImageOption">
        <trailhand-checkbox
          :value="deleteFromRegistry"
          :checked="deleteFromRegistry"
          @checkbox-change="(e: CustomEvent<{ checked: boolean }>) => { deleteFromRegistry = e.detail.checked; }"
        >Also delete images from registry</trailhand-checkbox>
        <p>When enabled, each application's container image will be removed from the registry.</p>
      </template>

      <template v-if="showDeletePVCOption">
        <trailhand-checkbox
          :value="deletePVC"
          :checked="deletePVC"
          @checkbox-change="(e: CustomEvent<{ checked: boolean }>) => { deletePVC = e.detail.checked; }"
        >Also delete PersistentVolumeClaims</trailhand-checkbox>
        <p>When enabled, staging and application data PersistentVolumeClaims will be removed.</p>
      </template>

      <p v-if="showUnbindNotice">
        Any bound applications will be automatically unbound before deletion.
      </p>

      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </div>

    <div slot="footer">
      <trailhand-button
        variant="secondary"
        class="mr-10"
        @button-click="closeDelete"
      >
        Cancel
      </trailhand-button>
      <trailhand-button
        variant="destructive"
        :disabled="deleting"
        @button-click="onSubmitDelete"
      >
        {{ deleting ? 'Deleting...' : t('generic.delete') }}
      </trailhand-button>
    </div>
  </trailhand-modal>
</template>

<style lang="scss" scoped>
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 500px;
}
</style>
