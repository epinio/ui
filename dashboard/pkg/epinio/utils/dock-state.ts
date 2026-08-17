import { reactive, markRaw } from 'vue';
import ApplicationLogs from '../windowComponents/ApplicationLogs.vue';
import ApplicationShell from '../windowComponents/ApplicationShell.vue';

/*
* Epinio-owned replacement for Rancher Shell's `wm` Vuex module. Holds the tabs
* shown in the EpinioDock (app logs, staging logs, app shell) and which Vue
* component + props renders each one. `EpinioDock.vue` reads this to drive
* `<trailhand-dock>`, and reflects tab-switch/tab-close events from the dock
* back into this state.
*/

const COMPONENTS = {
  ApplicationLogs:  markRaw(ApplicationLogs),
  ApplicationShell: markRaw(ApplicationShell),
};

export interface DockTabConfig {
  id: string;
  label: string;
  icon?: string;
  component: keyof typeof COMPONENTS;
  props?: Record<string, any>;
}

export interface DockTabEntry {
  id: string;
  label: string;
  icon?: string;
  component: any;
  props: Record<string, any>;
}

export const dockState: { tabs: DockTabEntry[], activeTab: string | null, open: boolean } = reactive({
  tabs:      [],
  activeTab: null,
  open:      false,
});

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
