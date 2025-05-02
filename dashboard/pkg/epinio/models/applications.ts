import { classify } from '@shell/plugins/dashboard-store/classify';
import { downloadFile } from '@shell/utils/download';
import { formatSi } from '@shell/utils/units';
import { identity, pickBy } from 'lodash';
import { epiniofy } from '../store/epinio-store/actions';
import {
  APPLICATION_ACTION_STATE, APPLICATION_SOURCE_TYPE, APPLICATION_PARTS, EPINIO_PRODUCT_NAME, EPINIO_TYPES
} from '../types';
import { createEpinioRoute } from '../utils/custom-routing';
import EpinioNamespacedResource, { bulkRemove } from './epinio-namespaced-resource';
import { AppUtils } from '../utils/application';
import { WORKLOAD_TYPES } from '@shell/config/types';
import { NAME as EXPLORER } from '@shell/config/product/explorer';

// See https://github.com/epinio/epinio/blob/00684bc36780a37ab90091498e5c700337015a96/pkg/api/core/v1/models/app.go#L11
enum STATES {
  CREATING = 'created',
  STAGING = 'staging',
  RUNNING = 'running',
  ERROR = 'error',
}

// These map to @shell/plugins/dashboard-store/resource-class STATES
const STATES_MAPPED: { [key: string]: string } = {
  [STATES.CREATING]: 'created',
  [STATES.STAGING]: 'building',
  [STATES.RUNNING]: 'running',
  [STATES.ERROR]: 'error',
  unknown: 'unknown',
};

function isGitRepo(type: string): boolean {
  return type === APPLICATION_SOURCE_TYPE.GIT_HUB || type === APPLICATION_SOURCE_TYPE.GIT_LAB;
}

export default class EpinioApplicationModel extends EpinioNamespacedResource {
  private buildCache?: { [key: string]: any };
  private statusMessage?: string;

  constructor(...args: any[]) {
    super(...args);
  }

  // ------------------------------------------------------------------
  // Dashboard plumbing

  get details(): any[] {
    const res: any[] = [];

    if (this.state === !!this.deployment) {
      res.push({
        label: 'Last Deployed By',
        content: this.deployment.username,
      });
    }

    return res;
  }

  get state(): string {
    return STATES_MAPPED[this.status] || STATES_MAPPED.unknown;
  }

  get stateObj(): { error: boolean, transitioning: boolean, message: string } {
    switch (this.status) {
      case STATES.CREATING:
        return {
          error: false,
          transitioning: false,
          message: this.statusmessage
        };
      case STATES.STAGING:
        return {
          error: false,
          transitioning: true,
          message: this.statusmessage
        };
      case STATES.RUNNING:
        return {
          error: false,
          transitioning: false,
          message: this.statusmessage
        };
      case STATES.ERROR:
        return {
          error: true,
          transitioning: false,
          message: this.statusmessage
        };
      default:
        return {
          error: true,
          transitioning: false,
          message: this.statusmessage
        };
    }
  }

}
