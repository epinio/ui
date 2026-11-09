import {
  makeEmptyCell,
  makeRouterLinks,
  makeRouterLinksOrEmpty,
  makeNameLinks,
  makeTextList,
  makeActionMenu,
  attachActionMenu,
  makeRouterLink,
  makeAppRoutesCell,
  makeBoundServicesCell,
  stateToTagVariant,
  stateToIcon,
  makeStateTag,
  makeCommitShaCell,
  makeCommitAuthorCell,
  makeProgressStateCell,
  overrideTableRowProp,
  overrideTableRows,
} from './table-formatters';

const makeRouter = () => ({
  resolve: jest.fn((loc: any) => ({ href: `/${ loc.name }` })),
  push:    jest.fn(),
}) as any;

const item = (name: string) => ({ meta: { name }, detailLocation: { name } });

describe('makeEmptyCell', () => {
  it('returns a span with a non-breaking space', () => {
    const el = makeEmptyCell();

    expect(el.tagName).toBe('SPAN');
    expect(el.textContent).toBe(' ');
  });
});

describe('makeRouterLinks', () => {
  it('renders one anchor per item, comma separated', () => {
    const el = makeRouterLinks([item('a'), item('b')], makeRouter());
    const links = el.querySelectorAll('a');

    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/a');
    expect(el.textContent).toBe('a, b');
  });

  it('pushes the location on click instead of following the href', () => {
    const router = makeRouter();
    const el = makeRouterLinks([item('a')], router);
    const event = new MouseEvent('click', { cancelable: true });

    el.querySelector('a')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(router.push).toHaveBeenCalledWith({ name: 'a' });
  });

  it('falls back to # when the router cannot resolve', () => {
    const router = makeRouter();

    router.resolve.mockImplementation(() => {
      throw new Error('no route');
    });

    const el = makeRouterLinks([item('a')], router);

    expect(el.querySelector('a')!.getAttribute('href')).toBe('#');
  });
});

describe('makeRouterLinksOrEmpty', () => {
  it.each([null, undefined, []])('returns an empty cell for %p', (items) => {
    expect(makeRouterLinksOrEmpty(items as any, makeRouter()).textContent).toBe(' ');
  });

  it('returns links when there are items', () => {
    expect(makeRouterLinksOrEmpty([item('a')], makeRouter()).querySelectorAll('a')).toHaveLength(1);
  });
});

describe('makeNameLinks', () => {
  it('builds namespaced detail routes when a namespace is given', () => {
    const router = makeRouter();

    makeNameLinks(['svc'], { cluster: 'local', namespace: 'ws', resource: 'services' }, router);

    expect(router.resolve).toHaveBeenCalledWith(expect.objectContaining({
      name:   'epinio-c-cluster-resource-namespace-id',
      params: expect.objectContaining({
        cluster: 'local', namespace: 'ws', resource: 'services', id: 'svc'
      }),
    }));
  });

  it('builds non-namespaced detail routes otherwise', () => {
    const router = makeRouter();

    makeNameLinks(['chart'], { cluster: 'local', resource: 'appcharts' }, router);

    expect(router.resolve.mock.calls[0][0].name).toBe('epinio-c-cluster-resource-id');
  });

  it('returns an empty cell for no names', () => {
    expect(makeNameLinks(null, { cluster: 'local', resource: 'x' }, makeRouter()).textContent).toBe(' ');
  });
});

describe('makeTextList', () => {
  it('joins items with commas', () => {
    expect(makeTextList(['a', 'b', 'c']).textContent).toBe('a, b, c');
  });

  it('is empty for no items', () => {
    expect(makeTextList([]).textContent).toBe('');
  });
});

describe('makeActionMenu', () => {
  it('drops showConfiguration and wraps string actions as callables', () => {
    const row = {
      id:               'menu-1',
      edit:             jest.fn(),
      availableActions: [
        { action: 'showConfiguration' },
        { action: 'edit', label: 'Edit' },
        { divider: true },
      ],
    };
    const el = makeActionMenu(row) as any;

    expect(el.tagName.toLowerCase()).toBe('trailhand-action-menu');
    expect(el.resource).toBe(row);
    expect(el.actions).toHaveLength(2);
    expect(el.actions[1]).toEqual({ divider: true });

    el.actions[0].action();
    expect(row.edit).toHaveBeenCalled();
  });

  it('returns the same element for the same row id', () => {
    const first = makeActionMenu({ id: 'menu-2', availableActions: [] });
    const second = makeActionMenu({ id: 'menu-2', availableActions: [{ action: 'x' }] }) as any;

    expect(second).toBe(first);
    expect(second.actions).toHaveLength(1);
  });

  it('falls back to meta.name for caching', () => {
    const first = makeActionMenu({ meta: { name: 'menu-3' } });

    expect(makeActionMenu({ meta: { name: 'menu-3' } })).toBe(first);
  });

  it('does not cache rows without an id', () => {
    expect(makeActionMenu({})).not.toBe(makeActionMenu({}));
  });
});

describe('attachActionMenu', () => {
  it('passes actions through unchanged', () => {
    const actions = [{ label: 'Delete', action: jest.fn() }] as any;
    const el = attachActionMenu({ id: 'attach-1', availableActions: actions }) as any;

    expect(el.actions).toBe(actions);
  });
});

describe('makeRouterLink', () => {
  it('returns a plain span without a location', () => {
    const el = makeRouterLink('text', null, makeRouter());

    expect(el.tagName).toBe('SPAN');
    expect(el.textContent).toBe('text');
  });

  it('returns an anchor that pushes on click', () => {
    const router = makeRouter();
    const el = makeRouterLink('text', { name: 'x' }, router);

    expect(el.getAttribute('href')).toBe('/x');
    el.click();
    expect(router.push).toHaveBeenCalledWith({ name: 'x' });
  });
});

describe('makeAppRoutesCell', () => {
  const app = (status: string, routes?: string[]) => ({ status, configuration: { routes } }) as any;

  it('returns an empty cell with no routes', () => {
    expect(makeAppRoutesCell(app('running', [])).textContent).toBe(' ');
    expect(makeAppRoutesCell(app('running')).textContent).toBe(' ');
  });

  it('renders external links when running', () => {
    const el = makeAppRoutesCell(app('running', ['a.io', 'b.io']));
    const links = el.querySelectorAll('a');

    expect(links).toHaveLength(2);
    expect(links[0].href).toBe('https://a.io/');
    expect(links[0].target).toBe('_blank');
    expect(el.textContent).toBe('https://a.io, https://b.io');
  });

  it('renders plain text when not running', () => {
    const el = makeAppRoutesCell(app('error', ['a.io']));

    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toBe('https://a.io');
  });
});

describe('makeBoundServicesCell', () => {
  it('prefers row.services as links', () => {
    const el = makeBoundServicesCell({ services: [item('db')], configuration: { services: ['other'] } }, makeRouter());

    expect(el.querySelector('a')!.textContent).toBe('db');
  });

  it('falls back to configuration.services as text', () => {
    const el = makeBoundServicesCell({ services: [], configuration: { services: ['db'] } }, makeRouter());

    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toBe('db');
  });

  it('returns an empty cell with no services', () => {
    expect(makeBoundServicesCell({}, makeRouter()).textContent).toBe(' ');
  });
});

describe('stateToTagVariant', () => {
  it.each([
    ['running', 'success'],
    ['ready', 'success'],
    ['deployed', 'success'],
    ['available', 'success'],
    ['error', 'error'],
    ['notready', 'warning'],
    ['not-ready', 'warning'],
    ['uninstalled', 'warning'],
    ['building', 'info'],
    ['deploying', 'info'],
    ['created', 'info'],
    ['staging', 'info'],
    ['updating', 'info'],
    ['something-unknown', 'default'],
  ])('maps %s to %s', (state, variant) => {
    expect(stateToTagVariant(state)).toBe(variant);
  });
});

describe('stateToIcon', () => {
  it.each([
    ['running', 'rocket'],
    ['deployed', 'rocket'],
    ['notready', 'warning'],
    ['not-ready', 'warning'],
    ['error', 'error'],
    ['fail', 'error'],
    ['building', 'tools'],
    ['staging', 'info'],
    ['deploying', 'info'],
    ['created', 'gear'],
    ['something-unknown', ''],
  ])('maps %s to %s', (state, icon) => {
    expect(stateToIcon(state)).toBe(icon);
  });
});

describe('makeStateTag', () => {
  it('builds the tag from row.status', () => {
    const tag = makeStateTag({ status: 'running', stateDisplay: 'Running' }) as any;

    expect(tag.tagName.toLowerCase()).toBe('trailhand-tag');
    expect(tag.label).toBe('Running');
    expect(tag.variant).toBe('success');
    expect(tag.icon).toBe('rocket');
    expect(tag.size).toBe('md');
  });

  it('falls back to an empty label without stateDisplay', () => {
    const tag = makeStateTag({ status: 'error' }) as any;

    expect(tag.variant).toBe('error');
    expect(tag.label).toBe('');
  });
});

describe('makeCommitShaCell', () => {
  it('links to the commit', () => {
    const el = makeCommitShaCell({ sha: 'abc123', htmlUrl: 'https://git/c/abc123' });
    const a = el.querySelector('a')!;

    expect(a.href).toBe('https://git/c/abc123');
    expect(a.textContent).toBe('abc123');
    expect(el.querySelector('trailhand-icon')).toBeNull();
  });

  it('adds the deployed icon when the commit matches', () => {
    const el = makeCommitShaCell({ sha: 'abc', commitId: 'abc' }, 'abc', 'Deployed');
    const icon = el.querySelector('trailhand-icon') as any;

    expect(icon.name).toBe('codeBranch');
    expect(icon.title).toBe('Deployed');
    expect(el.querySelector('a')!.getAttribute('href')).toBe('#');
  });
});

describe('makeCommitAuthorCell', () => {
  it('renders avatar and link when author data exists', () => {
    const el = makeCommitAuthorCell({
      author: { avatarUrl: 'https://a/img.png', htmlUrl: 'https://a/u', login: 'hb' }
    }, 'Unknown');

    expect(el.querySelector('img')!.src).toBe('https://a/img.png');
    expect(el.querySelector('a')!.textContent).toBe('hb');
  });

  it('prefers name over login', () => {
    const el = makeCommitAuthorCell({ author: { name: 'Hannah', login: 'hb' } }, 'Unknown');

    expect(el.querySelector('a')!.textContent).toBe('Hannah');
  });

  it('shows the unknown label without author data', () => {
    const el = makeCommitAuthorCell({}, 'Unknown');

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('Unknown');
  });
});

describe('makeProgressStateCell', () => {
  it('uses a contextual label while running', () => {
    const tag = makeProgressStateCell({ action: 'build', state: 'running' }) as any;

    expect(tag.label).toBe('Building');
    expect(tag.variant).toBe('info');
  });

  it('falls back to Running for unknown running actions', () => {
    expect((makeProgressStateCell({ action: 'mystery', state: 'running' }) as any).label).toBe('Running');
  });

  it.each([
    ['success', 'Success', 'success'],
    ['fail', 'Fail', 'error'],
    ['pending', 'Pending', 'default'],
  ] as const)('maps %s to label %s and variant %s', (state, label, variant) => {
    const tag = makeProgressStateCell({ action: 'build', state }) as any;

    expect(tag.label).toBe(label);
    expect(tag.variant).toBe(variant);
  });
});

describe('overrideTableRowProp', () => {
  it('overrides a getter-only property', () => {
    const row = Object.defineProperty({}, 'name', { get: () => 'old', configurable: true }) as any;

    overrideTableRowProp(row, 'name', 'new');

    expect(row.name).toBe('new');
    row.name = 'newer';
    expect(row.name).toBe('newer');
  });
});

describe('overrideTableRows', () => {
  it('applies static and computed overrides', () => {
    const rows = overrideTableRows([{ n: 1 }, { n: 2 }] as any[], [
      { prop: 'label', value: 'x' },
      { prop: 'double', value: (row: any) => row.n * 2 },
    ]);

    // overrides are defined non-enumerable, so check them directly rather than with toEqual
    expect(rows.map((r: any) => [r.label, r.double])).toEqual([['x', 2], ['x', 4]]);
  });

  it('skips rows that fail the condition', () => {
    const rows = overrideTableRows([{ n: 1 }, { n: 2 }] as any[], [
      { prop: 'big', value: true, conditionFn: (row: any) => row.n > 1 },
    ]);

    expect(rows[0].big).toBeUndefined();
    expect(rows[1].big).toBe(true);
  });
});
