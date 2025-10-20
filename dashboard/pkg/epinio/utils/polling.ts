import PollerSequential from '@shell/utils/poller-sequential';
import { _MERGE } from '@shell/plugins/dashboard-store/actions';

/*
* Moved this logic that was previously a shim in the store. that subscribed all
* resources called. Now this util will server in an al la carte fashion to start/stop
* polling on specific resource types as needed by particular lists or pages.
*/

const pollingRate = 20000; //20 seconds
const polling: any = {};

export function startPolling(types: string[], store: any): any {
  types.forEach((type) => {
    polling[type] = new PollerSequential(
      async() => {
        await store.dispatch('epinio/findAll', { type, opt: { force: true, load: _MERGE } });
      },
      pollingRate,
      5
    );
    polling[type].start();
  });
}

export function stopPolling(types: string[]): any {
  types.forEach((type) => {
    polling[type].stop();
  });
}
