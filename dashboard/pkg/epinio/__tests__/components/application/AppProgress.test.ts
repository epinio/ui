import { defineComponent, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import AppProgress from '../../../components/application/AppProgress.vue';
import { useAppForm } from '../../../models/application/form/useAppForm';
import { App } from '../../../models/application/ui-types';

// The pipeline talks to the API through createEpinioClient, so a fake client is the
// "backend": each test asserts on the exact paths and bodies it receives.
const mockClient = {
  get:    jest.fn(),
  post:   jest.fn(),
  patch:  jest.fn(),
  put:    jest.fn(),
  delete: jest.fn(),
};

const mockStore = {
  getters:  { 'i18n/t': (key: string, args?: any) => (args ? `${ key } ${ JSON.stringify(args) }` : key), isSingleProduct: false },
  dispatch: jest.fn(),
};

jest.mock('vuex', () => ({ useStore: () => mockStore }));
jest.mock('../../../api/client', () => ({ createEpinioClient: () => mockClient }));
jest.mock('../../../queries/useCluster', () => {
  const { ref } = jest.requireActual('vue');

  return { useCluster: () => ({ data: ref({ id: 'local', api: 'https://epinio.test' }) }) };
});
// Operations finish immediately, so waitForState returns without polling.
jest.mock('../../../queries/useApplicationQueries', () => {
  const { ref } = jest.requireActual('vue');

  return { useApplicationState: () => ({ data: ref({ operation: { id: 'op-1', phase: 'succeeded' } }) }) };
});
jest.mock('../../../models/application/actions/logs', () => ({ showStagingLog: jest.fn() }));
jest.mock('@shell/utils/array', () => ({ isArray: Array.isArray }));

const NS_PATH = '/api/v1/namespaces/workspace/applications';

// Responds like the Epinio API for the calls the create pipeline makes.
const routePost = (path: string) => {
  if (path === NS_PATH) {
    return {};
  }
  if (path.endsWith('/store')) {
    return { blobuid: 'blob-1' };
  }
  if (path.endsWith('/stage') || path.endsWith('/deploy')) {
    return { id: 'op-1' };
  }

  return {};
};

const apiApp = {
  meta:          { name: 'my-app', namespace: 'workspace', createdAt: '2026-11-20T00:00:00Z' },
  configuration: {},
  staging:       {},
  origin:        {},
};

const callsTo = (suffix: string) => mockClient.post.mock.calls.filter(([path]) => path.endsWith(suffix));
const bodyOf = (suffix: string) => callsTo(suffix)[0]?.[1];

// Renders the step rows so tests can read step state without the real web component.
const TrailhandTable = defineComponent({
  name:     'TrailhandTable',
  props:    {
    rows:    { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
  },
  template: '<div />',
});

type FormSetup = (f: ReturnType<typeof useAppForm>) => void;

const runPipeline = async(setupForm: FormSetup) => {
  const appForm = useAppForm(ref('create'), ref(false), ref<App | null>(null));

  appForm.update.details({ name: 'my-app', namespace: 'workspace' });
  setupForm(appForm);

  const callbacks = {
    onPipelineStart:   jest.fn(),
    onPipelineSuccess: jest.fn(),
    onPipelineFailure: jest.fn(),
    setModalToEdit:    jest.fn(),
  };
  const wrapper = mount(AppProgress, {
    props: {
      form:        appForm.form.value,
      initialForm: appForm.initialForm.value,
      initialApp:  null,
      formState:   appForm.state,
      mode:        'create',
      active:      false,
      deployOnly:  false,
      ...callbacks,
    },
    global: {
      components: { 'trailhand-table': TrailhandTable },
      // A failed run() rethrows and escapes AppProgress's watcher; swallow it so it
      // doesn't fail the test run. The failure itself is asserted through the UI.
      config:     { errorHandler: () => {} },
    },
  });

  // The pipeline starts when the Progress tab becomes active.
  await wrapper.setProps({ active: true });
  await flushPromises();

  const steps = () => wrapper.findComponent(TrailhandTable).props('rows') as any[];

  return {
    wrapper, callbacks, steps
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.post.mockImplementation(async(path: string) => routePost(path));
  mockClient.get.mockResolvedValue(apiApp);
});

describe('create payloads', () => {
  it('folder + buildpack + deploy: creates, uploads, then deploys with the blob', async() => {
    const tarball = new Blob(['zip-bytes']);
    const { callbacks, steps } = await runPipeline(({ update }) => {
      update.source('folder', { name: 'my-folder', tarball });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
      update.details({ routes: [], environment: [{ key: 'FOO', value: 'bar' }], settings: { keep: 'x', drop: '' } });
    });

    expect(mockClient.post).toHaveBeenCalledWith(NS_PATH, {
      name:          'my-app',
      configuration: {
        appchart:       '',
        configurations: [],
        environment:    { FOO: 'bar' },
        instances:      1,
        replace_env:    false,
        restart:        false,
        routes:         null,
        settings:       { keep: 'x' },
      },
    });

    const [, formData, opts] = callsTo('/my-app/store')[0];

    expect((formData as FormData).get('file')).toBeInstanceOf(Blob);
    expect(opts).toEqual({ headers: { 'File-Size': String(tarball.size) } });

    expect(bodyOf('/my-app/deploy')).toEqual({
      app:            { name: 'my-app', namespace: 'workspace', createdAt: '2026-11-20T00:00:00Z' },
      blobuid:        'blob-1',
      builderimage:   'paketo/builder',
      buildmode:      'buildpack',
      dockerfilepath: undefined,
      image:          undefined,
      origin:         {
        Kind: 1, archive: undefined, container: undefined, git: undefined, path: 'my-folder'
      },
      stage: undefined,
    });
    expect(callsTo('/stage')).toHaveLength(0);

    expect(steps().map((s) => [s.action, s.state])).toEqual([
      ['create', 'success'],
      ['upload', 'success'],
      ['deploy', 'success'],
    ]);
    expect(callbacks.onPipelineStart).toHaveBeenCalled();
    expect(callbacks.onPipelineSuccess).toHaveBeenCalled();
    expect(mockStore.dispatch).toHaveBeenCalledWith('growl/success', expect.anything());
  });

  it('build only (deploy off): stages instead of deploying', async() => {
    await runPipeline(({ update }) => {
      update.source('folder', { name: 'my-folder', tarball: new Blob(['x']) });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder', deploy: false });
    });

    expect(bodyOf('/my-app/stage')).toMatchObject({ blobuid: 'blob-1', builderimage: 'paketo/builder' });
    expect(callsTo('/deploy')).toHaveLength(0);
  });

  it('archive: marks the origin as an archive', async() => {
    await runPipeline(({ update }) => {
      update.source('archive', { name: 'app.tar.gz', tarball: new Blob(['x']) });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
    });

    expect(bodyOf('/my-app/deploy').origin).toMatchObject({ Kind: 1, archive: true, path: 'app.tar.gz' });
  });

  it('git url + dockerfile: no upload, git origin, dockerfile settings, no blob', async() => {
    await runPipeline(({ update }) => {
      update.source('gitUrl', { url: 'https://github.com/org/repo', branch: 'main', gitConfig: 'gh-creds' });
      update.buildOptions({ buildMode: 'dockerfile', dockerfilePath: 'docker/Dockerfile' });
    });

    expect(callsTo('/store')).toHaveLength(0);

    const body = bodyOf('/my-app/deploy');

    expect(body).toMatchObject({
      blobuid:        undefined,
      buildmode:      'dockerfile',
      dockerfilepath: 'docker/Dockerfile',
      origin:         {
        Kind: 2,
        git:  {
          repository: 'https://github.com/org/repo', revision: 'main', gitconfig: 'gh-creds'
        },
      },
    });
  });

  it('github: sends commit as revision, plus branch and provider', async() => {
    await runPipeline(({ update }) => {
      update.source('github', {
        userOrOrg: 'org', repository: 'repo', branch: 'main', commit: 'abc123', url: 'https://github.com/org/repo'
      } as any);
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
    });

    expect(bodyOf('/my-app/deploy').origin.git).toMatchObject({
      repository: 'https://github.com/org/repo', revision: 'abc123', branch: 'main', provider: 'github'
    });
  });

  it('container image: deploys the image with no build settings', async() => {
    await runPipeline(({ update }) => {
      update.source('containerUrl', { url: 'nginx:latest' });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
    });

    expect(callsTo('/store')).toHaveLength(0);
    expect(bodyOf('/my-app/deploy')).toMatchObject({
      image:        'nginx:latest',
      blobuid:      undefined,
      builderimage: undefined,
      buildmode:    undefined,
      origin:       { Kind: 3, container: 'nginx:latest' },
    });
  });

  it('binds configurations in one call and each service separately', async() => {
    await runPipeline(({ update }) => {
      update.source('containerUrl', { url: 'nginx' });
      update.bindings({ configurations: ['cfg-a', 'cfg-b'], services: ['db', 'cache'] });
    });

    expect(mockClient.post).toHaveBeenCalledWith(`${ NS_PATH }/my-app/configurationbindings`, { names: ['cfg-a', 'cfg-b'] });
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/namespaces/workspace/services/db/bind', { app_name: 'my-app' });
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/namespaces/workspace/services/cache/bind', { app_name: 'my-app' });
  });

  it('skips binding calls when nothing is selected', async() => {
    await runPipeline(({ update }) => update.source('containerUrl', { url: 'nginx' }));

    expect(callsTo('/configurationbindings')).toHaveLength(0);
    expect(callsTo('/bind')).toHaveLength(0);
  });
});

describe('errors', () => {
  it('a failed create stops the pipeline and reports the API message', async() => {
    mockClient.post.mockImplementation(async(path: string) => {
      if (path === NS_PATH) {
        throw new Error('application already exists');
      }

      return routePost(path);
    });

    const { callbacks, steps } = await runPipeline(({ update }) => {
      update.source('folder', { name: 'f', tarball: new Blob(['x']) });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
    });

    expect(steps().map((s) => [s.action, s.state])).toEqual([
      ['create', 'fail'],
      ['upload', 'pending'],
      ['deploy', 'pending'],
    ]);
    expect(steps()[0].stateMessage).toBe('application already exists');
    expect(callsTo('/store')).toHaveLength(0);
    expect(callsTo('/deploy')).toHaveLength(0);

    expect(mockStore.dispatch).toHaveBeenCalledWith('growl/error', {
      title:   'epinio.growl.application.deploy.error.title',
      message: expect.stringContaining('application already exists'),
    });
    expect(callbacks.onPipelineFailure).toHaveBeenCalled();
    expect(callbacks.onPipelineSuccess).not.toHaveBeenCalled();
    // Nothing was created, so the modal must stay in create mode.
    expect(callbacks.setModalToEdit).not.toHaveBeenCalled();
  });

  it('a failed upload after create switches the modal to edit, since the app now exists', async() => {
    mockClient.post.mockImplementation(async(path: string) => {
      if (path.endsWith('/store')) {
        throw new Error('upload too large');
      }

      return routePost(path);
    });

    const { callbacks, steps } = await runPipeline(({ update }) => {
      update.source('folder', { name: 'f', tarball: new Blob(['x']) });
      update.buildOptions({ buildMode: 'buildpack', builderImage: 'paketo/builder' });
    });

    expect(steps().map((s) => s.state)).toEqual(['success', 'fail', 'pending']);
    expect(steps()[1].stateMessage).toBe('upload too large');
    expect(callsTo('/deploy')).toHaveLength(0);
    expect(callbacks.onPipelineFailure).toHaveBeenCalled();
    expect(callbacks.setModalToEdit).toHaveBeenCalled();
  });

  it('a failed deploy marks only the deploy step as failed', async() => {
    mockClient.post.mockImplementation(async(path: string) => {
      if (path.endsWith('/deploy')) {
        throw new Error('image pull failed');
      }

      return routePost(path);
    });

    const { steps } = await runPipeline(({ update }) => update.source('containerUrl', { url: 'nginx' }));

    expect(steps().map((s) => [s.action, s.state, s.stateMessage])).toEqual([
      ['create', 'success', undefined],
      ['deploy', 'fail', 'image pull failed'],
    ]);
  });
});
