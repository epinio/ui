import { APPLICATION_MANIFEST_SOURCE_TYPE, APPLICATION_SOURCE_TYPE, EpinioApplicationResource, EpinioAppSource, EPINIO_APP_GIT_SOURCE } from '../types';
import { parse as parseUrl } from '@shell/utils/url';

interface Utils {
  getSourceType: (origin: EpinioApplicationResource['origin']) => APPLICATION_SOURCE_TYPE;
  getManifestSourceType: (origin: EpinioApplicationResource['origin']) => APPLICATION_SOURCE_TYPE;
  getGitData: (git: any) => EPINIO_APP_GIT_SOURCE;
  sourceFingerprint: (source?: EpinioAppSource | null) => string;
}

function getSourceType(origin: EpinioApplicationResource['origin']): APPLICATION_SOURCE_TYPE {
  switch (origin.Kind) {
  case APPLICATION_MANIFEST_SOURCE_TYPE.PATH:
    return origin.archive ? APPLICATION_SOURCE_TYPE.ARCHIVE : APPLICATION_SOURCE_TYPE.FOLDER;
  case APPLICATION_MANIFEST_SOURCE_TYPE.GIT:
    return (origin.git?.provider || APPLICATION_SOURCE_TYPE.GIT_URL) as APPLICATION_SOURCE_TYPE;
  case APPLICATION_MANIFEST_SOURCE_TYPE.CONTAINER:
    return APPLICATION_SOURCE_TYPE.CONTAINER_URL;
  default:
    return APPLICATION_SOURCE_TYPE.FOLDER;
  }
}

function getManifestSourceType(origin: EpinioApplicationResource['origin']): APPLICATION_SOURCE_TYPE {
  if (origin.git) {
    return (origin.git.provider || APPLICATION_SOURCE_TYPE.GIT_URL) as unknown as APPLICATION_SOURCE_TYPE;
  }
  if (origin.archive) {
    return APPLICATION_SOURCE_TYPE.ARCHIVE;
  }
  if (origin.container) {
    return APPLICATION_SOURCE_TYPE.CONTAINER_URL;
  }

  return APPLICATION_SOURCE_TYPE.FOLDER;
}

function getGitData(git: any): EPINIO_APP_GIT_SOURCE {
  const url = git.repository || git.url;
  const parsed = parseUrl(url);

  const parts = parsed.path.split('/');

  return {
    usernameOrOrg: parts[1],
    branch:        { name: git.branch },
    commit:        git.revision,
    repo:          { name: parts[2] },
    gitconfig:     git.gitconfig,
    url,
  };
}

// A deployed app records the url it was pushed with, while the git picker
// reports the provider's canonical one. Ignore the cosmetic difference.
function normalizeGitUrl(url?: string): string {
  return (url || '').trim().replace(/\/+$/, '').replace(/\.git$/, '');
}

// The picker holds a branch object, a deployed app holds just the name.
function branchName(branch: any): string {
  if (!branch) {
    return '';
  }

  return typeof branch === 'string' ? branch : branch.name || '';
}

// What the app would deploy, reduced to the fields that decide whether a
// redeploy is needed. The source form fills in every type's fields and swaps
// lightweight git identifiers for whole API objects once the picker hydrates,
// so diffing raw form state reports changes the user never made.
function sourceFingerprint(source?: EpinioAppSource | null): string {
  const type = source?.type || '';
  const builderImage = source?.builderImage || '';

  switch (type) {
  case APPLICATION_SOURCE_TYPE.ARCHIVE:
  case APPLICATION_SOURCE_TYPE.FOLDER:
    // The files live in the browser only, so a selection is all we can see.
    // Whether the folder's contents changed is unknowable from here.
    return JSON.stringify({
      type,
      builderImage,
      picked: !!source?.archive?.tarball,
    });
  case APPLICATION_SOURCE_TYPE.CONTAINER_URL:
    return JSON.stringify({ type, container: source?.container?.url || '' });
  case APPLICATION_SOURCE_TYPE.GIT_URL:
    return JSON.stringify({
      type,
      builderImage,
      url:       normalizeGitUrl(source?.gitUrl?.url),
      revision:  source?.gitUrl?.branch || '',
      gitconfig: source?.gitUrl?.gitconfig || '',
    });
  case APPLICATION_SOURCE_TYPE.GIT_HUB:
  case APPLICATION_SOURCE_TYPE.GIT_LAB:
    return JSON.stringify({
      type,
      builderImage,
      url:       normalizeGitUrl(source?.git?.url),
      branch:    branchName(source?.git?.branch),
      commit:    source?.git?.commit || '',
      gitconfig: source?.git?.gitconfig || '',
    });
  default:
    return JSON.stringify({ type });
  }
}

export const AppUtils: Utils = {
  getSourceType,
  getManifestSourceType,
  getGitData,
  sourceFingerprint,
};
