// Lives outside models/ because shell auto-registers every file under models/
// (subfolders included) as a resource model, so a test there would ship as one.
import EpinioApplicationModel from '../../models/applications';
import { APPLICATION_MANIFEST_SOURCE_TYPE } from '../../types';

// Shell ships these as untranspiled ESM. The getters under test don't touch
// them, so stub them out instead of loading the store plumbing.
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({
  __esModule: true,
  // Stand-in for Rancher's base Resource: the model filters these base actions.
  default:    class {
    get _availableActions() {
      return (this as any).baseActions || [];
    }
  },
}));
jest.mock('@shell/plugins/dashboard-store/classify', () => ({ classify: jest.fn() }));
jest.mock('@shell/utils/download', () => ({ downloadFile: jest.fn() }));
jest.mock('@shell/utils/units', () => ({ formatSi: jest.fn() }));
jest.mock('@shell/utils/array', () => ({ isArray: Array.isArray }));
jest.mock('@shell/config/types', () => ({ WORKLOAD_TYPES: { DEPLOYMENT: 'apps.deployment' } }));
jest.mock('@shell/config/product/explorer', () => ({ NAME: 'explorer' }));
jest.mock('../../store/epinio-store/actions', () => ({ epiniofy: jest.fn() }));

const GIT_ORIGIN = { Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT, git: { repository: 'https://example.com/org/repo.git', revision: 'abc123' } };
const CONTAINER_ORIGIN = { Kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER, container: 'nginx:latest' };

const makeApp = (fields: Record<string, any> = {}, perms: Record<string, boolean> = {}, rootGetters: Record<string, any> = {}): any => {
  const app: any = new EpinioApplicationModel();

  return Object.assign(app, {
    t:            (key: string) => key,
    $getters:     { schemaFor: () => undefined },
    $rootGetters: {
      'epinio/permissions': () => perms,
      'epinio/can':         (id: string) => !!perms[id],
      ...rootGetters,
    },
    staging:       {},
    configuration: { appchart: 'standard' },
    ...fields,
  });
};

// Dividers render as '---' so expected lists read like the menu.
const menu = (actions: any[]) => actions.map((a) => (a.divider ? '---' : a.action));

describe('stateObj', () => {
  it.each([
    ['created', false, false],
    ['staging', false, true],
    ['deploying', false, true],
    ['running', false, false],
    ['error', true, false],
    ['something-new', true, false],
    [undefined, true, false],
  ])('maps status %p to error=%p transitioning=%p', (status, error, transitioning) => {
    expect(makeApp({ status, statusmessage: 'msg' }).stateObj).toEqual({ error, transitioning, message: 'msg' });
  });
});

describe('metricsOk', () => {
  it('is true when there are no replicas to check', () => {
    expect(makeApp().metricsOk).toBe(true);
    expect(makeApp({ deployment: {} }).metricsOk).toBe(true);
    expect(makeApp({ deployment: { replicas: {} } }).metricsOk).toBe(true);
  });

  it('is true only when every replica reports metrics', () => {
    const replicas = (...oks: boolean[]) => Object.fromEntries(oks.map((metricsOk, i) => [`r${ i }`, { metricsOk }]));

    expect(makeApp({ deployment: { replicas: replicas(true, true) } }).metricsOk).toBe(true);
    expect(makeApp({ deployment: { replicas: replicas(true, false) } }).metricsOk).toBe(false);
  });
});

describe('_pruneOrphanedDividers', () => {
  const prune = (actions: any[]) => menu(makeApp()._pruneOrphanedDividers(actions));
  const a = (action: string, enabled?: boolean) => ({ action, enabled });
  const div = { divider: true };

  it('returns an empty list unchanged', () => {
    expect(prune([])).toEqual([]);
  });

  it('drops disabled items but keeps ones with no enabled flag', () => {
    expect(prune([a('one', true), a('two', false), a('three')])).toEqual(['one', 'three']);
  });

  it('strips leading and trailing dividers', () => {
    expect(prune([div, div, a('one'), div])).toEqual(['one']);
  });

  it('collapses consecutive dividers', () => {
    expect(prune([a('one'), div, div, a('two')])).toEqual(['one', '---', 'two']);
  });

  it('collapses dividers left adjacent by a removed item', () => {
    expect(prune([a('one'), div, a('two', false), div, a('three')])).toEqual(['one', '---', 'three']);
  });

  it('returns nothing when every item is disabled', () => {
    expect(prune([a('one', false), div, a('two', false)])).toEqual([]);
  });
});

describe('availableActions', () => {
  // What Rancher's base Resource hands the model to filter.
  const baseActions = [
    { action: 'goToEdit' },
    { action: 'showConfiguration' },
    { divider: true },
    { action: 'goToViewConfig' },
    { action: 'promptRemove' },
  ];

  it('falls back to the base actions until permissions load', () => {
    const app = makeApp({ status: 'running', origin: GIT_ORIGIN, baseActions }, {});

    expect(menu(app.availableActions)).toEqual(['goToEdit', 'showConfiguration', '---', 'goToViewConfig', 'promptRemove']);
  });

  it('shows everything to a full app + configuration user on a running app', () => {
    const app = makeApp(
      {
        status: 'running', stage_id: 's1', origin: GIT_ORIGIN, baseActions
      },
      { app: true, configuration_write: true },
    );

    expect(menu(app.availableActions)).toEqual([
      'showAppShell', 'showAppLog', 'showStagingLog', 'restage', 'restart', 'exportApp',
      '---', 'goToEdit', '---', 'goToViewConfig', 'promptRemove',
    ]);
  });

  it('leaves a logs-only user with just the app log', () => {
    const app = makeApp({ status: 'running', origin: GIT_ORIGIN, baseActions }, { app_logs: true });

    expect(menu(app.availableActions)).toEqual(['showAppLog']);
  });

  it('drops the divider after showConfiguration when config is not viewable', () => {
    const app = makeApp({ status: 'running', origin: GIT_ORIGIN, baseActions }, { app_update: true, app_delete: true });

    expect(menu(app.availableActions)).toEqual(['goToEdit', 'promptRemove']);
  });

  it('keeps logs and restage but hides running-only actions on an errored app', () => {
    const origin = { Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH, path: 'app.tgz', archive: true };
    const app = makeApp({ status: 'error', origin, blobuid: 'blob-1' }, { app: true });

    expect(menu(app.availableActions)).toEqual(['showAppLog', 'restage']);
  });

  it.each([
    ['status staging', { status: 'staging' }],
    ['status deploying', { status: 'deploying' }],
    ['an active staging job', { status: 'running', stagingstatus: 'active' }],
  ])('hides restage during %s', (_, fields) => {
    const app = makeApp({ ...fields, origin: GIT_ORIGIN }, { app: true });

    expect(menu(app.availableActions)).not.toContain('restage');
  });

  it('hides restage for container image apps', () => {
    const app = makeApp({ status: 'running', origin: CONTAINER_ORIGIN }, { app: true });

    expect(menu(app.availableActions)).toEqual(['showAppShell', 'showAppLog', 'restart', 'exportApp']);
  });

  it('adds viewDeployment when the deployment schema is available', () => {
    const app = makeApp({ $getters: { schemaFor: () => ({}) } }, {}, { isSingleProduct: false });

    expect(menu(app.availableActions)).toEqual(['viewDeployment']);
  });

  it('hides viewDeployment in single-product mode', () => {
    const app = makeApp({ $getters: { schemaFor: () => ({}) } }, {}, { isSingleProduct: true });

    expect(menu(app.availableActions)).toEqual([]);
  });
});

describe('appSourceInfo', () => {
  const info = (origin: any, staging: any = { builder: 'paketo' }) => makeApp({ origin, staging }).appSourceInfo;
  const appChart = { label: 'App Chart', value: 'standard' };
  const builder = { label: 'Builder Image', value: 'paketo' };

  it('describes an archive upload', () => {
    expect(info({ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH, path: 'app.tgz', archive: true })).toEqual({
      label:   'File system',
      icon:    'icon-file',
      details: [{ label: 'Original Name', value: 'app.tgz' }, appChart, builder],
    });
  });

  it('shows the dockerfile path instead of the builder in dockerfile mode', () => {
    const { details } = info(
      { Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH, path: 'app.tgz', archive: true },
      { builder: 'paketo', buildMode: 'dockerfile', dockerfilePath: 'Dockerfile.prod' },
    );

    expect(details).toContainEqual({ label: 'Dockerfile Path', value: 'Dockerfile.prod' });
    expect(details).not.toContainEqual(builder);
  });

  it('describes a plain git url', () => {
    expect(info(GIT_ORIGIN)).toEqual({
      label:   'Git',
      icon:    'icon-file',
      details: [
        { label: 'Url', value: 'https://example.com/org/repo.git' },
        {
          label: 'Revision', icon: 'icon-commit', value: 'abc123'
        },
        appChart,
        builder,
      ],
    });
  });

  it('describes a GitHub repo with its branch', () => {
    const origin = {
      Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT,
      git:  {
        provider: 'github', repository: 'https://github.com/org/repo', revision: 'abc123', branch: 'main'
      },
    };

    expect(info(origin)).toEqual({
      label:   'epinio.applications.gitSource.github.label',
      icon:    'icon-github',
      details: [
        { label: 'Url', value: 'https://github.com/org/repo' },
        {
          label: 'Revision', icon: 'icon-commit', value: 'abc123'
        },
        {
          label: 'Branch', icon: 'icon-commit', value: 'main'
        },
        appChart,
        builder,
      ],
    });
  });

  it('describes a container image without a builder', () => {
    expect(info(CONTAINER_ORIGIN)).toEqual({
      label:   'Container',
      icon:    'icon-docker',
      details: [{ label: 'Image', value: 'nginx:latest' }, appChart],
    });
  });
});
