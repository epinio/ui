import { UserManager } from 'oidc-client-ts';
import { EpinioInfo, EpinioVersion } from '../../types';

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

  // setOidcClient(state: any, oidcClient: UserManager) {
  //   state.oidcClient = oidcClient;
  // }
};
