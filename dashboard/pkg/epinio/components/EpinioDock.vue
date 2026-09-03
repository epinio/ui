<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { dockState, switchTab, closeTab, setHeight } from '../utils/dock-state';

const dockEl = ref<any>(null);

function setDockRef(el: any) {
  dockEl.value = el;
}

// Set properties directly on the element rather than via :tabs/:active-tab
// template bindings. Vue's kebab-case attribute fallback for custom elements
// doesn't reach camelCase Lit properties, this bit us before on action-menu's
// renderActions, doing it this way avoids the same issue here.
let wmHeightRafScheduled = false;

watchEffect(() => {
  if (!dockEl.value) {
    return;
  }

  dockEl.value.open = dockState.open;
  dockEl.value.activeTab = dockState.activeTab;
  dockEl.value.height = dockState.height;
  dockEl.value.tabs = dockState.tabs.map((tab) => ({
    id:    tab.id,
    label: tab.label,
    icon:  tab.icon,
  }));

  // Shell's page grid sizes the dock's row/column via the --wm-height/--wm-width
  // custom properties (see @rancher/shell's _layout.scss), previously only ever
  // set by Shell's own WindowManager. Since EpinioDock replaces WindowManager
  // for this product, it has to own setting them too, or the dock's grid cell
  // stays 0px and clips it regardless of what the dock itself renders.
  //
  // Unlike the property assignments above, this forces a full-page reflow
  // (it drives grid-template-rows on the root layout grid, not just the
  // dock's own box), so it's throttled to once per animation frame instead
  // of once per raw pointermove, which can fire faster than the page can
  // actually repaint and was visibly lagging behind the drag.
  if (!wmHeightRafScheduled) {
    wmHeightRafScheduled = true;

    requestAnimationFrame(() => {
      wmHeightRafScheduled = false;
      // Read dockState fresh here, not at schedule time, watchEffect may
      // have re-run several times (and skipped scheduling) before this fires.
      document.documentElement.style.setProperty('--wm-height', dockState.open ? `${ dockState.height }px` : '0px');
    });
  }
});

function onTabSwitch(e: Event) {
  switchTab((e as CustomEvent).detail.id);
}

function onTabClose(e: Event) {
  closeTab((e as CustomEvent).detail.id);
}

function onResize(e: Event) {
  setHeight((e as CustomEvent).detail.height);
}
</script>

<template>
  <trailhand-dock
    :ref="setDockRef"
    @dock-tab-switch="onTabSwitch"
    @dock-tab-close="onTabClose"
    @dock-resize="onResize"
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
