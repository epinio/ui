import type { EpinioInfo, EpinioVersion, EpinioMe } from '../../types';
import type { EpinioPermissions } from '../../utils/permissions';
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

  setSearchQuery(state: any, { type, query }: { type: string; query: string }) {
    if (!state.searchQuery) {
      state.searchQuery = {};
    }
    state.searchQuery[type] = query;
  },

  clearAll(state: any, type: string) {
    if (state.types?.[type]) {
      state.types[type].list = [];
    }
  },
};