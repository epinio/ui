// Several small stand-ins for trailhand web components live together here on purpose.
/* eslint-disable vue/one-component-per-file */
import { defineComponent } from 'vue';
import { mount, flushPromises, VueWrapper } from '@vue/test-utils';
import AppSource from '../../../components/application/AppSource.vue';
import { generateZip } from '../../../utils/download';
import { useApplications } from '../../../queries/useApplicationQueries';

const mockStore = { getters: { 'i18n/t': (key: string) => key } };

jest.mock('vuex', () => ({ useStore: () => mockStore }));
jest.mock('../../../queries/useGitConfigQueries', () => {
  const { ref } = jest.requireActual('vue');

  return {
    useGitConfigs: () => ({
      data: ref({ items: [{ meta: { name: 'gh-creds' } }] }), isLoading: ref(false), isError: ref(false)
    })
  };
});
jest.mock('../../../queries/useApplicationQueries', () => {
  const { ref } = jest.requireActual('vue');
  const data = ref({ items: [{ meta: { name: 'registry/app:1', namespace: 'workspace' } }] });

  return {
    useApplications: jest.fn(() => ({
      data, isLoading: ref(false), isError: ref(false)
    }))
  };
});
jest.mock('../../../utils/download', () => ({ generateZip: jest.fn(async() => new Blob(['zip'])) }));
jest.mock('../../../components/application/GitPicker.vue', () => jest.requireActual('vue').defineComponent({ name: 'GitPicker', template: '<div />' }));

// The trailhand inputs fire CustomEvents with a `detail` payload, so the stubs do the same.
const TrailhandDropdown = defineComponent({
  name:     'TrailhandDropdown',
  props:    {
    options:  { type: Array, default: () => [] },
    value:    { type: String, default: '' },
    disabled: Boolean,
    label:    { type: String, default: '' },
  },
  emits:    ['dropdown-change', 'dropdown-filter'],
  template: '<div />',
});
const TrailhandTextInput = defineComponent({
  name:     'TrailhandTextInput',
  props:    {
    value:    { type: String, default: '' },
    disabled: Boolean,
    label:    { type: String, default: '' },
  },
  emits:    ['text-input-change'],
  template: '<div />',
});
const TrailhandButton = defineComponent({
  name: 'TrailhandButton', props: { disabled: Boolean }, template: '<button><slot /></button>'
});

const mountSource = (source: any, extraProps: Record<string, any> = {}) => {
  const props = {
    source,
    mode:                'create',
    updateSource:        jest.fn(),
    populateFormFromApp: jest.fn(),
    updateDeployOnly:    jest.fn(),
    updateInitialApp:    jest.fn(),
    deployOnly:          false,
    ...extraProps,
  };

  const wrapper = mount(AppSource, {
    props,
    global: {
      components: {
        'trailhand-dropdown': TrailhandDropdown, 'trailhand-text-input': TrailhandTextInput, 'trailhand-button': TrailhandButton
      }
    },
  });

  return { wrapper, props };
};

const byTestId = (wrapper: VueWrapper, component: any, id: string) => wrapper.findAllComponents(component).find((c: any) => c.attributes('data-testid') === id)!;
const dropdownByLabel = (wrapper: VueWrapper, label: string) => wrapper.findAllComponents(TrailhandDropdown).find((c) => c.props('label') === label)!;
const change = (component: any, event: string, detail: any) => component.vm.$emit(event, { detail });

// Simulates picking files: jsdom doesn't let tests set input.files directly.
const pickFiles = async(input: any, files: any[]) => {
  Object.defineProperty(input.element, 'files', { value: files, configurable: true });
  await input.trigger('change');
  await flushPromises();
};

beforeEach(() => jest.clearAllMocks());

describe('source type', () => {
  it('offers every source type and reports a change', async() => {
    const { wrapper, props } = mountSource({ type: 'folder' });
    const typeDropdown = byTestId(wrapper, TrailhandDropdown, 'epinio_app-source_type');

    expect(typeDropdown.props('options').map((o: any) => o.value)).toEqual(['containerUrl', 'archive', 'folder', 'gitUrl', 'github', 'gitlab']);

    change(typeDropdown, 'dropdown-change', { value: 'gitUrl' });

    expect(props.updateSource).toHaveBeenCalledWith('gitUrl');
  });

  it('only fetches container images once the container source is picked', () => {
    const { wrapper } = mountSource({ type: 'folder' });
    const options = (useApplications as jest.Mock).mock.calls[0][2];

    expect(options.value.enabled).toBe(false);

    change(byTestId(wrapper, TrailhandDropdown, 'epinio_app-source_type'), 'dropdown-change', { value: 'containerUrl' });

    expect(options.value.enabled).toBe(true);
  });

  it('locks the source type when only deploying an existing build', () => {
    const { wrapper } = mountSource({ type: 'folder' }, { deployOnly: true });

    expect(byTestId(wrapper, TrailhandDropdown, 'epinio_app-source_type').props('disabled')).toBe(true);
  });
});

describe('git url source', () => {
  const branchInput = (wrapper: VueWrapper) => byTestId(wrapper, TrailhandTextInput, 'epinio_app-source_git-branch');

  it('enables the branch once the url is valid', () => {
    const { wrapper } = mountSource({ type: 'gitUrl', gitUrl: { url: 'https://github.com/org/repo', branch: '' } });

    expect(wrapper.find('.error-message').exists()).toBe(false);
    expect(branchInput(wrapper).props('disabled')).toBe(false);
  });

  it.each([
    'github.com/org/repo',
    'git@github.com:org/repo.git',
    'https://github.com/org/repo extra',
  ])('rejects %p and keeps the branch disabled', (url) => {
    const { wrapper } = mountSource({ type: 'gitUrl', gitUrl: { url, branch: '' } });

    expect(wrapper.find('.error-message').text()).toBe('epinio.applications.steps.source.gitUrl.error.label');
    expect(branchInput(wrapper).props('disabled')).toBe(true);
  });

  it('clears the branch when the url changes', () => {
    const { wrapper, props } = mountSource({ type: 'gitUrl', gitUrl: { url: 'https://github.com/org/repo', branch: 'main' } });

    change(byTestId(wrapper, TrailhandTextInput, 'epinio_app-source_git-url'), 'text-input-change', { value: 'https://github.com/org/other' });

    expect(props.updateSource).toHaveBeenCalledWith('gitUrl', { url: 'https://github.com/org/other', branch: '' });
  });

  it('reports branch and git config changes', () => {
    const { wrapper, props } = mountSource({ type: 'gitUrl', gitUrl: { url: 'https://github.com/org/repo', branch: '' } });

    change(branchInput(wrapper), 'text-input-change', { value: 'main' });
    change(dropdownByLabel(wrapper, 'Git Config'), 'dropdown-change', { value: 'gh-creds' });

    expect(props.updateSource).toHaveBeenCalledWith('gitUrl', { branch: 'main' });
    expect(props.updateSource).toHaveBeenCalledWith('gitUrl', { gitConfig: 'gh-creds' });
  });
});

describe('container source', () => {
  it('picking a catalog image switches the modal to deploy that build', () => {
    const { wrapper, props } = mountSource({ type: 'containerUrl', containerUrl: { url: '' } });

    change(dropdownByLabel(wrapper, 'Container Image'), 'dropdown-change', { value: 'registry/app:1' });

    const image = { meta: { name: 'registry/app:1', namespace: 'workspace' } };

    expect(props.updateSource).toHaveBeenCalledWith('containerUrl', { url: 'registry/app:1' });
    expect(props.populateFormFromApp).toHaveBeenCalledWith(image, true);
    expect(props.updateInitialApp).toHaveBeenCalledWith(image);
    expect(props.updateDeployOnly).toHaveBeenCalledWith(true);
  });

  it('a custom image unlocks the text input and does not switch to deploy-only', () => {
    const { wrapper, props } = mountSource({ type: 'containerUrl', containerUrl: { url: 'nginx:latest' } });

    expect(dropdownByLabel(wrapper, 'Container Image').props('value')).toBe('custom');
    expect(byTestId(wrapper, TrailhandTextInput, 'epinio_app-source_container').props('disabled')).toBe(false);

    change(dropdownByLabel(wrapper, 'Container Image'), 'dropdown-change', { value: 'custom' });

    expect(props.populateFormFromApp).not.toHaveBeenCalled();
    expect(props.updateDeployOnly).not.toHaveBeenCalled();
  });

  it('locks the url input when a catalog image is selected', () => {
    const { wrapper } = mountSource({ type: 'containerUrl', containerUrl: { url: 'registry/app:1' } });

    expect(byTestId(wrapper, TrailhandTextInput, 'epinio_app-source_container').props('disabled')).toBe(true);
  });
});

describe('file sources', () => {
  it('archive: passes the picked file and its name', async() => {
    const { wrapper, props } = mountSource({ type: 'archive', archive: { name: '' } });
    const file = new File(['x'], 'app.tar.gz');

    await pickFiles(wrapper.find('input[accept]'), [file]);

    expect(props.updateSource).toHaveBeenCalledWith('archive', { tarball: file, name: 'app.tar.gz' });
  });

  it('folder: zips the files without the shared root folder and names the source after it', async() => {
    const { wrapper, props } = mountSource({ type: 'folder', folder: { name: '' } });
    const index = { webkitRelativePath: 'my-app/index.js' };
    const nested = { webkitRelativePath: 'my-app/src/a.js' };

    await pickFiles(wrapper.find('input[webkitdirectory]'), [index, nested]);

    expect(generateZip).toHaveBeenCalledWith({ 'index.js': index, 'src/a.js': nested });
    expect(props.updateSource).toHaveBeenCalledWith('folder', { tarball: expect.any(Blob), name: 'my-app' });
  });

  it('folder: keeps full paths and a generic name when roots differ', async() => {
    const { wrapper, props } = mountSource({ type: 'folder', folder: { name: '' } });
    const a = { webkitRelativePath: 'one/a.js' };
    const b = { webkitRelativePath: 'two/b.js' };

    await pickFiles(wrapper.find('input[webkitdirectory]'), [a, b]);

    expect(generateZip).toHaveBeenCalledWith({ 'one/a.js': a, 'two/b.js': b });
    expect(props.updateSource).toHaveBeenCalledWith('folder', { tarball: expect.any(Blob), name: 'folder' });
  });
});

describe('manifest', () => {
  // The manifest input is the first file input; it has no accept/webkitdirectory.
  const manifestInput = (wrapper: VueWrapper) => wrapper.findAll('input[type="file"]')[0];
  const manifestFile = (text: string) => ({ text: async() => text });

  it('fills the form from a valid manifest without marking it as the initial state', async() => {
    const { wrapper, props } = mountSource({ type: 'folder' });
    const yaml = [
      'name: my-app',
      'namespace: workspace',
      'origin:',
      '  git:',
      '    url: https://github.com/org/repo',
      '    revision: main',
      'configuration:',
      '  instances: 2',
      'staging:',
      '  builder: paketo/builder',
    ].join('\n');

    await pickFiles(manifestInput(wrapper), [manifestFile(yaml)]);

    expect(props.populateFormFromApp).toHaveBeenCalledTimes(1);

    const [manifest, setInitial] = props.populateFormFromApp.mock.calls[0];

    expect(setInitial).toBe(false);
    expect(manifest).toMatchObject({
      meta:          { namespace: 'workspace' },
      configuration: { instances: 2 },
      staging:       { builder: 'paketo/builder' },
      origin:        { git: { repository: 'https://github.com/org/repo', revision: 'main' } },
    });
  });

  it.each([
    ['invalid yaml', 'name: [unclosed'],
    ['an empty file', ''],
  ])('ignores %s', async(_label, text) => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper, props } = mountSource({ type: 'folder' });

    await pickFiles(manifestInput(wrapper), [manifestFile(text)]);

    expect(props.populateFormFromApp).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
