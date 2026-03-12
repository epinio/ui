import { EpinioInfo, EpinioVersion } from '../../types';
import { SetPaginationPagePayload, SetPaginationMetaPayload } from './types';

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

  setPaginationPage(state: any, { type, page }: SetPaginationPagePayload) {
    if (!state.paginationPage) {
      state.paginationPage = {};
    }
    state.paginationPage[type] = page;
  },

  setPaginationMeta(state: any, { type, meta }: SetPaginationMetaPayload) {
    if (!state.paginationMeta) {
      state.paginationMeta = {};
    }
    state.paginationMeta[type] = meta;
  },
};
