import { reactive } from 'vue';

/*
* Epinio-owned replacement for the slice of Rancher Shell's `prefs` Vuex
* module ApplicationLogs.vue read/wrote (LOGS_WRAP, LOGS_TIME, DATE_FORMAT,
* TIME_FORMAT). Only `wrap` has ever had UI to change it here, the other
* three are exposed for parity but stay at Shell's own defaults until a
* settings UI for them exists.
*/

const STORAGE_KEY_WRAP = 'epinio-logs-wrap';

function readWrap(): boolean {
  const stored = window.localStorage.getItem(STORAGE_KEY_WRAP);

  return stored === null ? true : stored === 'true';
}

export const logPrefs = reactive({
  wrap:       readWrap(),
  timestamps: true,
  dateFormat: 'ddd, MMM D YYYY',
  timeFormat: 'h:mm:ss a',
});

export function setLogWrap(value: boolean): void {
  logPrefs.wrap = value;
  window.localStorage.setItem(STORAGE_KEY_WRAP, String(value));
}
