import { _MERGE } from '@shell/plugins/dashboard-store/actions';
import PollerSequential from '@shell/utils/poller-sequential';

const polling: any = {};
const POLL_INTERVAL = 10000;

export const actions = {
  unsubscribe() {
    Object.entries(polling).forEach(([type, poll]: [any, any]) => {
      console.warn('Epinio: Polling stopped for: ', type);
      poll.stop();
      delete polling[type];
    });
  },

  watch({ dispatch, rootGetters }: any, { type }: any) {
    if (rootGetters['type-map/isSpoofed'](type) || polling[type]) {
      // Ignore spoofed
      return;
    }

    console.warn('Epinio: Polling started for: ', type);

    polling[type] = new PollerSequential(
      async() => {
        console.debug('Epinio: Polling: ', type);
        // NOTE - In order for lists to automatically update resources opt to MERGE data in place instead of replace
        // (in rancher land these are all handled individually, here we have bulk changes)
        await dispatch('findAll', { type, opt: { force: true, load: _MERGE } });
      },
      POLL_INTERVAL,
      5
    );
    polling[type].start();
  },

};

export const getters = {
  watchStarted: () => (obj: any) => {
    return !!polling[obj.type];
  },
};
