import { createApp, type App } from 'vue';
import EpinioDock from '../components/EpinioDock.vue';
import cleanHtmlDirective from '../directives/clean-html';
import { dockState } from './dock-state';

/*
* Mounts EpinioDock as its own Vue app root appended directly to document.body,
* rather than patching it into Rancher Shell's own root chrome (default.vue).
* Standalone mode tolerated that patch, but Shell forces reloads of its root
* chrome in extension mode that would tear the dock down along with it. A
* node appended straight to body sits outside whatever Shell reloads, so it
* survives.
*
* A second createApp() root inherits nothing from the host app, so it's handed
* the globals the dock's tab components need by hand. Keep this in sync with
* whatever ApplicationLogs/ApplicationShell (rendered inside EpinioDock via
* dock-state's tab config) actually use. Epinio-owned versions only, no Shell
* imports here: this file mounts outside Shell entirely, it shouldn't take on
* a runtime dependency on Shell's own modules.
*/

// The width of the Rancher app-bar, which is 70px when showing. When the app-bar is hidden (single-product mode) the dock should be flush left at 0px.
const APP_BAR_WIDTH = 70;

let dockApp: App | null = null;
let dockEl: HTMLElement | null = null;

function dockLeftOffset(store: any): string {
  return store.getters['isSingleProduct'] ? '0' : `${ APP_BAR_WIDTH }px`;
}

export function mountDock(store: any): void {
  if (dockApp) {
    return;
  }

  dockEl = document.createElement('div');

  // trailhand-dock's :host is `display: block` so it can be sized by its parent, but we want it to sit on top of the page
  // and not push the page content down, so we position it fixed to the bottom of the viewport, offset left past the
  // Rancher app-bar (when it's showing). z-index 100 is above Shell's own chrome (z-index 1) but below any modal dialogs (z-index 200).
  Object.assign(dockEl.style, {
    position: 'fixed',
    left:     dockLeftOffset(store),
    right:    '0',
    bottom:   '0',
    zIndex:   '100',
  });
  document.body.appendChild(dockEl);

  dockApp = createApp(EpinioDock);
  dockApp.use(store); // useStore(), and i18n via store.getters['i18n/t']
  dockApp.directive('clean-html', cleanHtmlDirective); // ApplicationShell
  dockApp.mount(dockEl);
}

// Tear the dock down when the user navigates out of Epinio (onLeave), so it
// doesn't linger over other Rancher products in extension mode. mountDock()
// rebuilds it on re-entry.
// The dock's state is reset to empty, so onEnter doesn't re-open the last tab from the previous cluster.
export function unmountDock(): void {
  dockApp?.unmount();
  dockEl?.remove();
  dockApp = null;
  dockEl = null;
  dockState.tabs = [];
  dockState.activeTab = null;
  dockState.open = false;
}
