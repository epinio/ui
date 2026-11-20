// Several small stand-ins for trailhand web components live together here on purpose.
/* eslint-disable vue/one-component-per-file */
import { defineComponent, nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import AppModal from '../../../components/application/AppModal.vue';

const mockStore = { getters: { 'i18n/t': (key: string) => key } };

jest.mock('vuex', () => ({ useStore: () => mockStore }));

// Child steps are stubbed: these tests drive the form through the update functions
// AppModal hands them, and check the modal's tab gating and close behavior.
// A function declaration (and requireActual) because jest hoists the mocks above imports.
function stubStep(name: string, props: string[]) {
  return jest.requireActual('vue').defineComponent({
    name, props, template: '<div />'
  });
}

jest.mock('../../../components/application/AppSource.vue', () => stubStep('AppSource', ['source', 'mode', 'updateSource', 'populateFormFromApp', 'deployOnly', 'updateDeployOnly', 'updateInitialApp']));
jest.mock('../../../components/application/AppBuildOptions.vue', () => stubStep('AppBuildOptions', ['buildOptions', 'sourceType', 'modalOpen', 'mode', 'active', 'updateBuildOptions', 'deployOnly']));
jest.mock('../../../components/application/AppInfo.vue', () => stubStep('AppInfo', ['details', 'mode', 'source', 'chart', 'active', 'updateDetails', 'updateChartSettings', 'updateBindings', 'deployOnly']));
jest.mock('../../../components/application/AppConfiguration.vue', () => stubStep('AppConfiguration', ['bindings', 'namespace', 'mode', 'active', 'updateBindings']));
jest.mock('../../../components/application/AppProgress.vue', () => stubStep('AppProgress', ['form', 'initialForm', 'initialApp', 'formState', 'mode', 'active', 'onPipelineStart', 'onPipelineSuccess', 'onPipelineFailure', 'setModalToEdit', 'deployOnly']));

const TrailhandModal = defineComponent({
  name:     'TrailhandModal',
  props:    { title: { type: String, default: '' }, subtitle: { type: String, default: '' } },
  template: '<div><slot /></div>',
});

const TrailhandButton = defineComponent({
  name:     'TrailhandButton',
  props:    { variant: { type: String, default: '' }, disabled: Boolean },
  emits:    ['button-click'],
  template: '<button><slot /></button>',
});

const mountModal = async() => {
  const wrapper = mount(AppModal, {
    global: { components: { 'trailhand-modal': TrailhandModal, 'trailhand-button': TrailhandButton } },
  });

  await (wrapper.vm as any).openCreate();
  await nextTick();

  return wrapper;
};

const button = (wrapper: VueWrapper, label: string) => wrapper.findAllComponents(TrailhandButton).find((b) => b.text() === label);
const click = async(wrapper: VueWrapper, label: string) => {
  button(wrapper, label)!.vm.$emit('button-click');
  await nextTick();
};
const step = (wrapper: VueWrapper, name: string) => wrapper.findComponent({ name });
const tabDisabled = (wrapper: VueWrapper, label: string) => wrapper.findAll('[role="tab"]').find((t) => t.text() === label)!.attributes('disabled') !== undefined;
// AppModal binds `:open.prop`, which lands as a DOM property on the stub's root element.
const isOpen = (wrapper: VueWrapper) => (wrapper.findComponent(TrailhandModal).element as any).open;

const fillValidForm = async(wrapper: VueWrapper) => {
  step(wrapper, 'AppSource').props('updateSource')('containerUrl', { url: 'nginx:latest' });
  step(wrapper, 'AppInfo').props('updateDetails')({ name: 'my-app', namespace: 'workspace' });
  await nextTick();
};

describe('AppModal create flow', () => {
  it('opens in create mode on the source tab with an empty folder source', async() => {
    const wrapper = await mountModal();

    expect(isOpen(wrapper)).toBe(true);
    expect(wrapper.findComponent(TrailhandModal).props('subtitle')).toBe('Create New');
    expect(step(wrapper, 'AppSource').props('source')).toEqual({ type: 'folder' });
    expect(step(wrapper, 'AppSource').props('mode')).toBe('create');
  });

  it('blocks Next until the source is valid', async() => {
    const wrapper = await mountModal();

    expect(button(wrapper, 'generic.next')!.props('disabled')).toBe(true);
    expect(tabDisabled(wrapper, 'Build Options')).toBe(true);

    step(wrapper, 'AppSource').props('updateSource')('containerUrl', { url: 'nginx:latest' });
    await nextTick();

    expect(button(wrapper, 'generic.next')!.props('disabled')).toBe(false);
    expect(tabDisabled(wrapper, 'Build Options')).toBe(false);
  });

  it('keeps Bindings and Progress locked until details are valid', async() => {
    const wrapper = await mountModal();

    step(wrapper, 'AppSource').props('updateSource')('containerUrl', { url: 'nginx:latest' });
    await nextTick();

    expect(tabDisabled(wrapper, 'Details')).toBe(false);
    expect(tabDisabled(wrapper, 'Bindings')).toBe(true);
    expect(tabDisabled(wrapper, 'Progress')).toBe(true);

    step(wrapper, 'AppInfo').props('updateDetails')({ name: 'my-app' });
    await nextTick();
    expect(tabDisabled(wrapper, 'Progress')).toBe(true);

    step(wrapper, 'AppInfo').props('updateDetails')({ namespace: 'workspace' });
    await nextTick();
    expect(tabDisabled(wrapper, 'Bindings')).toBe(false);
    expect(tabDisabled(wrapper, 'Progress')).toBe(false);
  });

  it('has no Save/Deploy shortcut in create mode', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);

    expect(button(wrapper, 'generic.save')).toBeUndefined();
    expect(button(wrapper, 'generic.deploy')).toBeUndefined();
  });

  it('walks to Progress with Next and activates the pipeline with the filled form', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);
    step(wrapper, 'AppConfiguration').props('updateBindings')({ configurations: ['cfg-a'] });
    await nextTick();

    for (let i = 0; i < 4; i++) {
      await click(wrapper, 'generic.next');
    }

    const progress = step(wrapper, 'AppProgress');

    expect(progress.props('active')).toBe(true);
    expect(progress.props('mode')).toBe('create');
    expect(progress.props('form')).toMatchObject({
      source:   { type: 'containerUrl', containerUrl: { url: 'nginx:latest' } },
      details:  { name: 'my-app', namespace: 'workspace' },
      bindings: { configurations: ['cfg-a'] },
    });
    // Cancel/Previous/Next are hidden while on Progress; only Finish remains.
    expect(wrapper.findAllComponents(TrailhandButton).map((b) => b.text())).toEqual(['generic.finish']);
  });

  it('locks the tabs while the pipeline runs and closes on success', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);
    step(wrapper, 'AppProgress').props('onPipelineStart')();
    await nextTick();

    expect(tabDisabled(wrapper, 'Source')).toBe(true);
    expect(tabDisabled(wrapper, 'Details')).toBe(true);

    step(wrapper, 'AppProgress').props('onPipelineSuccess')();
    await nextTick();

    expect(isOpen(wrapper)).toBe(false);
    expect(step(wrapper, 'AppSource').props('source')).toEqual({ type: 'folder' });
  });

  it('stays open and switches to edit mode when the pipeline fails after the app was created', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);
    step(wrapper, 'AppProgress').props('onPipelineStart')();
    step(wrapper, 'AppProgress').props('onPipelineFailure')();
    step(wrapper, 'AppProgress').props('setModalToEdit')();
    await nextTick();

    expect(isOpen(wrapper)).toBe(true);
    expect(tabDisabled(wrapper, 'Source')).toBe(false);
    expect(step(wrapper, 'AppSource').props('mode')).toBe('edit');
  });
});

describe('AppModal closing', () => {
  it('closes straight away when nothing was changed', async() => {
    const wrapper = await mountModal();

    await click(wrapper, 'generic.cancel');

    expect(isOpen(wrapper)).toBe(false);
  });

  it('asks before discarding changes, and Keep Editing keeps them', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);
    await click(wrapper, 'generic.cancel');

    expect(isOpen(wrapper)).toBe(true);
    expect(wrapper.text()).toContain('generic.unsavedChanges');

    await click(wrapper, 'generic.keepEditing');

    expect(wrapper.text()).not.toContain('generic.unsavedChanges');
    expect(step(wrapper, 'AppInfo').props('details')).toMatchObject({ name: 'my-app' });
  });

  it('Discard clears the form and closes', async() => {
    const wrapper = await mountModal();

    await fillValidForm(wrapper);
    await click(wrapper, 'generic.cancel');
    await click(wrapper, 'generic.discard');

    expect(isOpen(wrapper)).toBe(false);
    expect(step(wrapper, 'AppInfo').props('details')).toMatchObject({ name: '', namespace: '' });
  });
});
