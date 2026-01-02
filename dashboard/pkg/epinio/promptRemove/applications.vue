<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { resourceNames } from '@shell/utils/string'
import Checkbox from '@components/Form/Checkbox/Checkbox.vue'

const props = defineProps<{
  value: any[]
  names: string[]
  type: string
}>();
const store = useStore()
const t = store.getters['i18n/t'];

const deleteImage = ref(false);

const plusMore = computed(() => {
  const remaining = props.names.length - 5; //5 is the max specified in resourceNames func
  return t('promptRemove.andOthers', { count: remaining })
})

// This allows us to pass the deleteImage option to the remove function in the parent PromptRemove component
const remove = async () => {
  // Set the deleteImage flag on each application to be removed
  props.value.forEach((app: any) => {
    app._deleteImage = deleteImage.value;
  });

  //  Return false to indicate no error occurred
  return false;
}

defineExpose({
  remove
});

</script>

<template>
  <div>
    {{ t('promptRemove.attemptingToRemove', { type }) }} <span
      v-clean-html="resourceNames(names, plusMore, t)"
    />
    <div class="mt-20">
      <Checkbox
        v-model:value="deleteImage"
        label-key="epinio.applications.deleteImage.label"
        class="mb-10"
      />
      <div class="text-muted ml-20">
        {{ t('epinio.applications.deleteImage.description') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.text.info {
  display: flex;
  align-items: center;

  > span {
    margin-right: 5px;
  }
}

.text-muted {
  font-size: 13px;
  color: var(--input-label);
}
</style>
