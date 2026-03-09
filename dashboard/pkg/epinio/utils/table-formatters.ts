import type { Router } from 'vue-router';

/**
 * Returns an empty non-breaking space cell element.
 */
export function makeEmptyCell(): HTMLSpanElement {
  const span = document.createElement('span');

  span.innerHTML = '&nbsp;';

  return span;
}

/**
 * Returns a span containing comma-separated router-navigable anchor elements.
 * Each item must expose `detailLocation` (for router resolution) and `meta.name` (for display).
 */
export function makeRouterLinks(
  items: Array<{ detailLocation: any; meta: { name: string } }>,
  router: Router
): HTMLSpanElement {
  const span = document.createElement('span');

  items.forEach((item, index) => {
    const a = document.createElement('a');

    try {
      a.href = router.resolve(item.detailLocation).href;
    } catch {
      a.href = '#';
    }

    a.addEventListener('click', (e) => {
      e.preventDefault();
      router.push(item.detailLocation);
    });

    a.textContent = item.meta.name;
    span.appendChild(a);

    if (index < items.length - 1) {
      span.appendChild(document.createTextNode(', '));
    }
  });

  return span;
}

/**
 * Returns router links for `items` if the array is non-empty, otherwise an empty cell.
 */
export function makeRouterLinksOrEmpty(
  items: Array<{ detailLocation: any; meta: { name: string } }> | null | undefined,
  router: Router
): HTMLElement {
  return items?.length ? makeRouterLinks(items, router) : makeEmptyCell();
}

/**
 * Returns a span containing comma-separated plain text spans.
 */
export function makeTextList(items: string[]): HTMLSpanElement {
  const span = document.createElement('span');

  items.forEach((text, index) => {
    const s = document.createElement('span');

    s.textContent = text;
    span.appendChild(s);

    if (index < items.length - 1) {
      span.appendChild(document.createTextNode(', '));
    }
  });

  return span;
}

/**
 * Returns an action-menu element for a table row.
 * Transforms epinio string action names into callable functions
 * so the action-menu web component can invoke them.
 */
export function makeActionMenu(row: any): HTMLElement {
  const el = document.createElement('trailhand-action-menu') as any;

  el.resource = row;
  el.actions = (row.availableActions || []).map((action: any) => {
    if (action.divider || typeof action.action !== 'string') {
      return action;
    }

    const actionName = action.action;

    return { ...action, action: () => row[actionName]?.() };
  });

  return el;
}

/**
 * Creates a single anchor element navigating to a router location,
 * or a plain span with the text if no location is provided.
 */
export function makeRouterLink(text: string, location: any, router: Router): HTMLElement {
  if (!location) {
    const span = document.createElement('span');

    span.textContent = text;

    return span;
  }

  const a = document.createElement('a');

  try { a.href = router.resolve(location).href; } catch { a.href = '#'; }
  a.addEventListener('click', (e) => {
    e.preventDefault();
    router.push(location);
  });
  a.textContent = text;

  return a;
}

/**
 * Renders an application's routes as external links (when running) or plain text.
 */
export function makeAppRoutesCell(row: any): HTMLElement {
  if (!row.routes?.length) return makeEmptyCell();

  const span = document.createElement('span');

  span.style.wordBreak = 'break-word';

  row.routes.forEach((route: string, index: number) => {
    const url = `https://${ route }`;

    if (row.state === 'running') {
      const a = document.createElement('a');

      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      a.textContent = url;
      span.appendChild(a);
    } else {
      const s = document.createElement('span');

      s.textContent = url;
      span.appendChild(s);
    }

    if (index < row.routes.length - 1) {
      span.appendChild(document.createTextNode(', '));
    }
  });

  return span;
}

/**
 * Renders bound services for an application row.
 * Prefers `row.services` (with detailLocation) for router links;
 * falls back to `row.configuration.services` (plain strings) for a text list.
 */
export function makeBoundServicesCell(row: any, router: Router): HTMLElement {
  const services = row.services?.length ? row.services : null;
  const configServices = !services && row.configuration?.services?.length
    ? row.configuration.services
    : null;

  if (!services && !configServices) return makeEmptyCell();

  return services ? makeRouterLinks(services, router) : makeTextList(configServices);
}

/**
 * Maps an epinio state string to a trailhand-tag variant.
 * Covers both application states and cluster states.
 */
export function stateToTagVariant(state: string): string {
  switch (state) {
    case 'running':
    case 'ready':
    case 'deployed':
    case 'available': return 'success';
    case 'error': return 'error';
    case 'notready':
    case 'not-ready':
    case 'uninstalled': return 'warning';
    case 'building':
    case 'created':
    case 'updating': return 'info';
    default: return 'default';
  }
}

/**
 * Maps an epinio application state string to a trailhand icon name.
 */
export function stateToIcon(state: string): string {
  switch (state) {
    case 'running': 
    case 'deployed': return 'rocket';
    case 'notready':
    case 'not-ready': return 'warning';
    case 'error': 
    case 'fail': return 'error';
    case 'building': return 'tools';
    case 'created': return 'gear';
    default: return '';
  }
}

/**
 * Creates a trailhand-tag element representing an application's current state.
 */
export function makeStateTag(row: any): HTMLElement {
  const tag = document.createElement('trailhand-tag') as any;

  tag.label = row.stateDisplay || '';
  tag.variant = stateToTagVariant(row.state);
  tag.size = 'md';
  tag.icon = stateToIcon(row.state);

  return tag;
}

/**
 * Maps an application action state (success/running/fail/pending) to a trailhand-tag variant.
 */
function actionStateToTagVariant(state: string): string {
  switch (state) {
    case 'success': return 'success';
    case 'fail': return 'error';
    case 'running': return 'info';
    default: return 'default'; // pending
  }
}

const runningLabels: Record<string, string> = {
  build:              'Building',
  deploy:             'Deploying',
  upload:             'Uploading',
  gitFetch:           'Fetching',
  create:             'Creating',
  create_namespace:   'Creating NS',
  bind_configurations: 'Binding',
  bind_services:      'Binding',
  updateSource:       'Updating',
};

/**
 * Creates a commit SHA cell: an external link to the commit, with an optional
 * "deployed" icon if `deployedCommitId` matches `row.commitId`.
 */
export function makeCommitShaCell(row: any, deployedCommitId?: string, deployedTitle?: string): HTMLElement {
  const div = document.createElement('div');

  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.gap = '4px';

  const a = document.createElement('a');

  a.href = row.htmlUrl || '#';
  a.target = '_blank';
  a.rel = 'noopener noreferrer nofollow';
  a.textContent = row.sha || '';
  div.appendChild(a);

  if (deployedCommitId && row.commitId === deployedCommitId) {
    const icon = document.createElement('i');

    icon.className = 'icon icon-fw icon-commit';
    if (deployedTitle) icon.title = deployedTitle;
    div.appendChild(icon);
  }

  return div;
}

/**
 * Creates a commit author cell: avatar + external link if author data is available,
 * or a plain span with `unknownLabel` if not.
 */
export function makeCommitAuthorCell(row: any, unknownLabel: string): HTMLElement {
  const div = document.createElement('div');

  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.gap = '8px';

  if (row.author) {
    const img = document.createElement('img');

    img.src = row.author.avatarUrl || '';
    img.alt = '';
    img.style.width = '30px';
    img.style.height = '30px';
    img.style.borderRadius = 'var(--border-radius)';
    div.appendChild(img);

    const a = document.createElement('a');

    a.href = row.author.htmlUrl || '#';
    a.target = '_blank';
    a.rel = 'nofollow noopener noreferrer';
    a.textContent = row.author.name || row.author.login || '';
    div.appendChild(a);
  } else {
    const span = document.createElement('span');

    span.textContent = unknownLabel;
    div.appendChild(span);
  }

  return div;
}

/**
 * Creates the state cell for the build progress table.
 */
export function makeProgressStateCell(row: any): HTMLElement {
  const tag = document.createElement('trailhand-tag') as any;

  if (row.state === 'running') {
    tag.label = runningLabels[row.action] || 'Running';
  } else {
    tag.label = row.stateDisplay || row.state || '';
  }

  tag.variant = actionStateToTagVariant(row.state);
  tag.size = 'md';

  return tag;
}
