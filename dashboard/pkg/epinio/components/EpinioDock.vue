<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { dockState, switchTab, closeTab } from '../utils/dock-state';

const dockEl = ref<any>(null);

function setDockRef(el: any) {
  dockEl.value = el;
}

// Set properties directly on the element rather than via :tabs/:active-tab
// template bindings. Vue's kebab-case attribute fallback for custom elements
// doesn't reach camelCase Lit properties, this bit us before on action-menu's
// renderActions, doing it this way avoids the same issue here.
watchEffect(() => {
  if (!dockEl.value) {
    return;
  }

  dockEl.value.open = dockState.open;
  dockEl.value.activeTab = dockState.activeTab;
  dockEl.value.tabs = dockState.tabs.map((tab) => ({
    id:    tab.id,
    label: tab.label,
    icon:  tab.icon,
  }));
});

function onTabSwitch(e: Event) {
  switchTab((e as CustomEvent).detail.id);
}

function onTabClose(e: Event) {
  closeTab((e as CustomEvent).detail.id);
}
</script>

<template>
  <trailhand-dock
    :ref="setDockRef"
    @dock-tab-switch="onTabSwitch"
    @dock-tab-close="onTabClose"
  >
    <component
      :is="tab.component"
      v-for="tab in dockState.tabs"
      :key="tab.id"
      v-bind="tab.props"
      :slot="`tab:${tab.id}`"
    />
  </trailhand-dock>
</template>
