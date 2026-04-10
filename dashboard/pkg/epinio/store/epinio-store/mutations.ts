import type { EpinioInfo, EpinioVersion, EpinioMe } from '../../types';
import type { EpinioPermissions } from '../../utils/permissions';

export default {

  singleProductCNSI(state: any, singleProductCNSI: any) {
    state.singleProductCNSI = singleProductCNSI;
  },

  info(state: any, info: EpinioInfo) {
    state.info = info;
  },

  version(state: any, version: EpinioVersion) {
    state.version = version;
  },

  me(state: any, me: EpinioMe) {
    state.me = me;
  },

  permissions(state: any, permissions: EpinioPermissions) {
    state.permissions = permissions;
  },

  reset(state: any) {
    state.me = undefined;
    state.permissions = undefined;
  },
};
