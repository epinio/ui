import { AppUtils } from './application';
import { APPLICATION_MANIFEST_SOURCE_TYPE, APPLICATION_SOURCE_TYPE } from '../../types';

const { getSourceType, getManifestSourceType, getGitData, sourceFingerprint } = AppUtils;

describe('getSourceType', () => {
  it.each([
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH }, APPLICATION_SOURCE_TYPE.FOLDER],
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.PATH, archive: true }, APPLICATION_SOURCE_TYPE.ARCHIVE],
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT }, APPLICATION_SOURCE_TYPE.GIT_URL],
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.GIT, git: { provider: 'github' } }, APPLICATION_SOURCE_TYPE.GIT_HUB],
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER }, APPLICATION_SOURCE_TYPE.CONTAINER_URL],
    [{ Kind: APPLICATION_MANIFEST_SOURCE_TYPE.NONE }, APPLICATION_SOURCE_TYPE.FOLDER],
    [{}, APPLICATION_SOURCE_TYPE.FOLDER],
  ])('maps %p to %s', (origin, expected) => {
    expect(getSourceType(origin as any)).toBe(expected);
  });
});

describe('getManifestSourceType', () => {
  it.each([
    [{ git: { provider: 'gitlab' } }, APPLICATION_SOURCE_TYPE.GIT_LAB],
    [{ git: {} }, APPLICATION_SOURCE_TYPE.GIT_URL],
    [{ archive: true }, APPLICATION_SOURCE_TYPE.ARCHIVE],
    [{ container: 'nginx' }, APPLICATION_SOURCE_TYPE.CONTAINER_URL],
    [{}, APPLICATION_SOURCE_TYPE.FOLDER],
  ])('maps %p to %s', (origin, expected) => {
    expect(getManifestSourceType(origin as any)).toBe(expected);
  });
});

describe('getGitData', () => {
  it('splits org and repo out of the url', () => {
    expect(getGitData({
      repository: 'https://github.com/epinio/epinio',
      branch:     'main',
      revision:   'abc123',
      gitconfig:  'gh',
    })).toEqual({
      usernameOrOrg: 'epinio',
      branch:        { name: 'main' },
      commit:        'abc123',
      repo:          { name: 'epinio' },
      gitconfig:     'gh',
      url:           'https://github.com/epinio/epinio',
    });
  });

  it('falls back to url when repository is missing', () => {
    expect(getGitData({ url: 'https://gitlab.com/org/repo' }).repo).toEqual({ name: 'repo' });
  });
});

describe('sourceFingerprint', () => {
  const git = (url: string, branch: any, extra = {}) => ({
    type: APPLICATION_SOURCE_TYPE.GIT_HUB,
    git:  { url, branch, commit: 'abc', ...extra },
  }) as any;

  it('handles a missing source', () => {
    expect(sourceFingerprint(null)).toBe(JSON.stringify({ type: '' }));
    expect(sourceFingerprint()).toBe(JSON.stringify({ type: '' }));
  });

  it('ignores trailing slashes and .git in git urls', () => {
    expect(sourceFingerprint(git('https://github.com/o/r.git', 'main')))
      .toBe(sourceFingerprint(git('https://github.com/o/r/', 'main')));
  });

  it('treats a branch object and branch name as the same', () => {
    expect(sourceFingerprint(git('https://github.com/o/r', { name: 'main', sha: 'x' })))
      .toBe(sourceFingerprint(git('https://github.com/o/r', 'main')));
  });

  it('ignores fields from other source types', () => {
    const base = git('https://github.com/o/r', 'main');

    expect(sourceFingerprint({ ...base, container: { url: 'nginx' } }))
      .toBe(sourceFingerprint(base));
  });

  it('changes when the commit changes', () => {
    expect(sourceFingerprint(git('https://github.com/o/r', 'main', { commit: 'def' })))
      .not.toBe(sourceFingerprint(git('https://github.com/o/r', 'main')));
  });

  it('compares git url sources by url, branch, and gitconfig', () => {
    const src = (url: string, branch: string) => ({
      type:   APPLICATION_SOURCE_TYPE.GIT_URL,
      gitUrl: { url, branch },
    }) as any;

    expect(sourceFingerprint(src('https://x/o/r.git', 'main'))).toBe(sourceFingerprint(src('https://x/o/r', 'main')));
    expect(sourceFingerprint(src('https://x/o/r', 'main'))).not.toBe(sourceFingerprint(src('https://x/o/r', 'dev')));
  });

  it('only tracks whether an archive or folder was picked', () => {
    const src = (type: string, tarball?: any) => ({ type, archive: { tarball } }) as any;

    expect(sourceFingerprint(src(APPLICATION_SOURCE_TYPE.ARCHIVE, 'a.tgz')))
      .toBe(sourceFingerprint(src(APPLICATION_SOURCE_TYPE.ARCHIVE, 'b.tgz')));
    expect(sourceFingerprint(src(APPLICATION_SOURCE_TYPE.FOLDER, 'a')))
      .not.toBe(sourceFingerprint(src(APPLICATION_SOURCE_TYPE.FOLDER)));
  });

  it('only tracks the image for container sources', () => {
    const src = (url: string, builderImage?: string) => ({
      type: APPLICATION_SOURCE_TYPE.CONTAINER_URL, container: { url }, builderImage
    }) as any;

    expect(sourceFingerprint(src('nginx', 'a'))).toBe(sourceFingerprint(src('nginx', 'b')));
    expect(sourceFingerprint(src('nginx'))).not.toBe(sourceFingerprint(src('redis')));
  });
});
