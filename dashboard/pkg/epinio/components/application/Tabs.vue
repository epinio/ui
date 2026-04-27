<script setup lang="ts">
import { ref, computed } from 'vue'

export interface Tab {
  id: string | number
  label: string
  disabled?: boolean
  completed?: boolean
}

const props = withDefaults(
  defineProps<{
    tabs: Tab[]
    modelValue?: string | number
  }>(),
  {
    modelValue: undefined,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'tab-change': [tab: Tab]
}>()

const activeTab = computed({
  get: () => props.modelValue ?? props.tabs.find((t) => !t.disabled)?.id,
  set: (val) => emit('update:modelValue', val!),
})

function selectTab(tab: Tab) {
  if (tab.disabled) return
  activeTab.value = tab.id
  emit('tab-change', tab)
}


</script>

<template>
  <div class="tabs-wrapper">
    <!-- Tab List -->
    <div class="tab-list" role="tablist">
      <button
        v-for="(tab) in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-disabled="tab.disabled"
        :disabled="tab.disabled"
        :class="[
          'tab-btn',
          { active: activeTab === tab.id },
          { disabled: tab.disabled },
          { completed: tab.completed && activeTab !== tab.id },
        ]"
        @click="selectTab(tab)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Panels -->
    <div class="tab-panels">
      <div
        v-for="tab in tabs"
        :key="'panel-' + tab.id"
        role="tabpanel"
        :aria-labelledby="String(tab.id)"
        :hidden="activeTab !== tab.id"
        :class="['tab-panel', { 'tab-panel--active': activeTab === tab.id }]"
      >
        <slot :name="tab.id" :tab="tab" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs-wrapper {
  width: 100%;
}

.tab-list {
  display: flex;
  overflow: hidden;
  width: 100%;
  gap: 4px;
}

.tab-btn {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--th-button-disabled-bg, #F0F0F0);
  color: var(--th-button-disabled-color, #9C9C9C);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 100%;
  padding: 3px 0px 3px 0px;
  min-height: 0;
  height: auto;
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  z-index: 1;
  position: relative;
}

.tab-btn.active {
  background: var(--th-button-alternate-bg, #EEF7FF);
  color: var(--th-button-alternate-color, #0086FF);
}

.tab-btn.completed {
  background: var(--th-button-confirmation-bg, #097409);
  color: var(--th-button-confirmation-color, #ffffff);
}

.tab-btn.disabled {
  color: var(--th-button-disabled-color, #9C9C9C);
  cursor: not-allowed;
  background: var(--th-button-disabled-bg, #F0F0F0);
}

/* ── Tab panels ───────────────────────────────────── */
.tab-panels {
  margin-top: 16px;
}

.tab-panel {
  display: none;
}

.tab-panel--active {
  display: block;
}
</style>