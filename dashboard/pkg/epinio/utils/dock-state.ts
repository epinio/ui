import { reactive, markRaw, defineAsyncComponent } from 'vue';
import type { AvailableIcons } from '@krumio/trailhand-ui';

/*
* Epinio-owned replacement for Rancher Shell's `wm` Vuex module. Holds the tabs
* shown in the EpinioDock (app logs, staging logs, app shell) and which Vue
* component + props renders each one. `EpinioDock.vue` reads this to drive
* `<trailhand-dock>`, and reflects tab-switch/tab-close events from the dock
* back into this state.
*
* ApplicationLogs/ApplicationShell are loaded lazily (defineAsyncComponent),
* not imported statically, since dock-state is pulled in by EpinioDock.vue,
* which is now part of default.vue's root chrome loaded on every page. A
* static import would drag the whole log/terminal dependency chain (xterm,
* Shell's Select component, etc) into the app's core bundle on every page
* load instead of only when a tab is actually opened, same as Shell's own
* window components were always lazy-loaded before this.
*/

const COMPONENTS = {
  ApplicationLogs:  markRaw(defineAsyncComponent(() => import('../windowComponents/ApplicationLogs.vue'))),
  ApplicationShell: markRaw(defineAsyncComponent(() => import('../windowComponents/ApplicationShell.vue'))),
};

export interface DockTabConfig {
  id: string;
  label: string;
  icon?: AvailableIcons;
  component: keyof typeof COMPONENTS;
  props?: Record<string, any>;
}

export interface DockTabEntry {
  id: string;
  label: string;
  icon?: AvailableIcons;
  component: any;
  props: Record<string, any>;
}

const storedHeight = Number(window.localStorage.getItem('wm-height'));

export const dockState: { tabs: DockTabEntry[], activeTab: string | null, open: boolean, height: number } = reactive({
  tabs:      [],
  activeTab: null,
  open:      false,
  height:    storedHeight > 0 ? storedHeight : 300,
});

let persistHeightTimer: ReturnType<typeof setTimeout> | null = null;

export function setHeight(height: number): void {
  dockState.height = height;

  // localStorage.setItem is a synchronous, blocking write. Fine once, not
  // dozens of times a second while a resize drag is in progress.
  if (persistHeightTimer) {
    clearTimeout(persistHeightTimer);
  }
  persistHeightTimer = setTimeout(() => {
    window.localStorage.setItem('wm-height', String(height));
  }, 300);
}

export function openTab(tab: DockTabConfig): void {
  if (dockState.tabs.some((t) => t.id === tab.id)) {
    dockState.activeTab = tab.id;

    return;
  }

  dockState.tabs.push({
    id:        tab.id,
    label:     tab.label,
    icon:      tab.icon,
    component: COMPONENTS[tab.component],
    props:     tab.props || {},
  });
  dockState.activeTab = tab.id;
  dockState.open = true;
}

export function closeTab(id: string): void {
  const idx = dockState.tabs.findIndex((t) => t.id === id);

  if (idx === -1) {
    return;
  }

  dockState.tabs.splice(idx, 1);

  if (dockState.tabs.length === 0) {
    dockState.open = false;
  }
}

export function switchTab(id: string): void {
  if (dockState.tabs.some((t) => t.id === id)) {
    dockState.activeTab = id;
  }
}

export function closeTabsMatching(prefix: string): void {
  dockState.tabs
    .filter((t) => t.id.startsWith(prefix))
    .forEach((t) => closeTab(t.id));
}
