<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { resourceNames } from '@shell/utils/string'

const props = defineProps<{
  value: any[]
  names: string[]
  type: string
}>();
const store = useStore()
const t = store.getters['i18n/t'];

const plusMore = computed(() => {
  const remaining = props.names.length - 5; //5 is the max specified in resourceNames func
  return t('promptRemove.andOthers', { count: remaining })
})

const bounded = computed(() => {
  return props.value?.reduce((acc, svc) => {
    const apps = svc?.boundapps ?? []
    return [...acc, ...apps]
  }, []) || []
})

</script>

<template>
   <div>
      {{ t('promptRemove.attemptingToRemove', { type }) }} <span
        v-clean-html="resourceNames(props.names, plusMore, t)"
      />
    <div
      v-if="!bounded.length"
      class="text info mb-10 mt-20"
    >
      <span>
        {{ t('epinio.services.applicationsNotBound') }}
      </span>
      <i class="icon icon-checkmark" />
    </div>
    <div
      v-if="bounded.length"
      class="text-warning mb-10 mt-20"
    >
      {{ t('epinio.services.applicationsBound', { count: bounded.length }) }}
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
</style>
