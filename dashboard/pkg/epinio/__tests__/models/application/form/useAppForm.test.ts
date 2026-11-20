// Lives outside models/ because shell auto-registers every file under models/
// (subfolders included) as a resource model, so a test there would ship as one.
import { ref } from 'vue';
import { useAppForm } from '../../../../models/application/form/useAppForm';
import { App } from '../../../../models/application/ui-types';

const setup = ({ mode = 'create' as 'create' | 'edit', deployOnly = false, initialApp = null as App | null } = {}) => {
  return useAppForm(ref(mode), ref(deployOnly), ref(initialApp));
};

const blob = () => new Blob(['x']);

describe('source validation', () => {
  it.each([
    ['folder without tarball', 'folder', { name: 'app' }, false],
    ['folder with tarball', 'folder', { name: 'app', tarball: blob() }, true],
    ['archive without tarball', 'archive', { name: 'app.zip' }, false],
    ['archive with tarball', 'archive', { name: 'app.zip', tarball: blob() }, true],
    ['container without url', 'containerUrl', { url: '' }, false],
    ['container with url', 'containerUrl', { url: 'nginx:latest' }, true],
    ['git url without branch', 'gitUrl', { url: 'https://github.com/o/r' }, false],
    ['git url with branch', 'gitUrl', { url: 'https://github.com/o/r', branch: 'main' }, true],
    ['github without commit', 'github', { userOrOrg: 'o', repository: 'r', branch: 'main' }, false],
    ['github complete', 'github', { userOrOrg: 'o', repository: 'r', branch: 'main', commit: 'abc' }, true],
    ['gitlab complete', 'gitlab', { userOrOrg: 'o', repository: 'r', branch: 'main', commit: 'abc' }, true],
  ])('create: %s -> %p', (_label, type, source, valid) => {
    const { state, update } = setup();

    update.source(type as any, source as any);

    expect(state.source.valid.value).toBe(valid);
  });

  it('edit: an untouched folder source is valid on its name alone', () => {
    const { state, update, initialForm } = setup({ mode: 'edit' });

    update.source('folder', { name: 'app' });
    initialForm.value.source = { type: 'folder', folder: { name: 'app' } };

    expect(state.source.dirty.value).toBe(false);
    expect(state.source.valid.value).toBe(true);
  });

  it('edit: a changed folder source needs a new tarball', () => {
    const { state, update } = setup({ mode: 'edit' });

    update.source('folder', { name: 'other' });

    expect(state.source.dirty.value).toBe(true);
    expect(state.source.valid.value).toBe(false);
  });

  it('deployOnly with an already built image skips source checks', () => {
    const { state } = setup({ deployOnly: true, initialApp: { builtImageUrl: 'registry/app:1' } as App });

    expect(state.source.valid.value).toBe(true);
  });
});

describe('build options validation', () => {
  const withFolder = () => {
    const form = setup();

    form.update.source('folder', { name: 'app', tarball: blob() });

    return form;
  };

  it('buildpack needs a builder image', () => {
    const { state, update } = withFolder();

    update.buildOptions({ buildMode: 'buildpack' });
    expect(state.buildOptions.valid.value).toBe(false);

    update.buildOptions({ builderImage: 'paketo/builder' });
    expect(state.buildOptions.valid.value).toBe(true);
  });

  it('buildpack without an image is allowed when the builder image catalog is forbidden', () => {
    const { state, update } = withFolder();

    update.buildOptions({ buildMode: 'buildpack', builderImagesForbidden: true });

    expect(state.buildOptions.valid.value).toBe(true);
  });

  it.each([
    ['', false],
    ['   ', false],
    ['/abs/Dockerfile', false],
    ['\\abs\\Dockerfile', false],
    ['C:\\Dockerfile', false],
    ['C:/Dockerfile', false],
    ['../Dockerfile', false],
    ['docker/../../Dockerfile', false],
    ['docker/Docker file', false],
    ['Dockerfile', true],
    ['docker/Dockerfile.prod', true],
  ])('dockerfile path %p -> %p', (dockerfilePath, valid) => {
    const { state, update } = withFolder();

    update.buildOptions({ buildMode: 'dockerfile', dockerfilePath });

    expect(state.buildOptions.valid.value).toBe(valid);
  });

  it('applies the same dockerfile rules to git sources', () => {
    const { state, update } = setup();

    update.source('gitUrl', { url: 'https://github.com/o/r', branch: 'main' });
    update.buildOptions({ buildMode: 'dockerfile', dockerfilePath: '/Dockerfile' });

    expect(state.buildOptions.valid.value).toBe(false);
  });

  it('container sources need no build options', () => {
    const { state, update } = setup();

    update.source('containerUrl', { url: 'nginx' });

    expect(state.buildOptions.valid.value).toBe(true);
  });
});

describe('details validation', () => {
  it('requires a name and a namespace', () => {
    const { state, update } = setup();

    expect(state.details.valid.value).toBe(false);

    update.details({ name: 'app' });
    expect(state.details.valid.value).toBe(false);

    update.details({ namespace: 'workspace' });
    expect(state.details.valid.value).toBe(true);
  });

  it('rejects negative instances', () => {
    const { state, update } = setup();

    update.details({ name: 'app', namespace: 'ws', instances: -1 });

    expect(state.details.valid.value).toBe(false);
  });

  it.each([
    ['', true],
    ['5', true],
    ['0', false],
    ['11', false],
    ['abc', false],
  ])('numeric chart setting %p in range 1-10 -> %p', (value, valid) => {
    const { state, update } = setup();

    update.chartSettings([{ name: 'replicas', type: 'integer', minimum: 1, maximum: 10 }]);
    update.details({ name: 'app', namespace: 'ws', settings: { replicas: value } });

    expect(state.details.valid.value).toBe(valid);
  });

  it('ignores min/max on non-numeric settings', () => {
    const { state, update } = setup();

    update.chartSettings([{ name: 'tier', type: 'string', minimum: 1 }]);
    update.details({ name: 'app', namespace: 'ws', settings: { tier: 'abc' } });

    expect(state.details.valid.value).toBe(true);
  });
});

describe('form state', () => {
  it('is only valid once every section is valid', () => {
    const { state, update } = setup();

    update.source('containerUrl', { url: 'nginx' });
    expect(state.valid.value).toBe(false);

    update.details({ name: 'app', namespace: 'ws' });
    expect(state.valid.value).toBe(true);
  });

  it('tracks dirty state and clears it on clearForm', () => {
    const { state, update, clearForm, form } = setup();

    expect(state.dirty.value).toBe(false);

    update.details({ name: 'app' });
    expect(state.dirty.value).toBe(true);
    expect(state.details.dirty.value).toBe(true);
    expect(state.source.dirty.value).toBe(false);

    clearForm();
    expect(state.dirty.value).toBe(false);
    expect(form.value.details.name).toBe('');
  });

  it('update.source keeps fields from earlier updates of the same type', () => {
    const { form, update } = setup();

    update.source('gitUrl', { url: 'https://github.com/o/r' });
    update.source('gitUrl', { branch: 'main' });

    expect(form.value.source).toEqual({ type: 'gitUrl', gitUrl: { url: 'https://github.com/o/r', branch: 'main' } });
  });
});
