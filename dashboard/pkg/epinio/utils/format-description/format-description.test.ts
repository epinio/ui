import { extractDescriptionLinks, formatDescriptionHtml, normalizeUrlMatch } from './format-description';

describe('normalizeUrlMatch', () => {
  it('strips trailing sentence punctuation', () => {
    expect(normalizeUrlMatch('https://example.com/docs.')).toEqual({
      url: 'https://example.com/docs',
      trailing: '.',
    });
  });

  it('keeps balanced parentheses in the URL', () => {
    expect(normalizeUrlMatch('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual({
      url: 'https://en.wikipedia.org/wiki/Foo_(bar)',
      trailing: '',
    });
  });

  it('strips unmatched trailing parentheses', () => {
    expect(normalizeUrlMatch('https://example.com/docs)')).toEqual({
      url: 'https://example.com/docs',
      trailing: ')',
    });
  });
});

describe('formatDescriptionHtml', () => {
  it('returns empty string for empty input', () => {
    expect(formatDescriptionHtml('')).toBe('');
    expect(formatDescriptionHtml(null)).toBe('');
    expect(formatDescriptionHtml(undefined)).toBe('');
  });

  it('escapes HTML and preserves plain text', () => {
    expect(formatDescriptionHtml('Hello <script>alert(1)</script>')).toContain('Hello');
    expect(formatDescriptionHtml('Hello <script>alert(1)</script>')).not.toContain('<script>');
  });

  it('linkifies http(s) URLs', () => {
    const html = formatDescriptionHtml(
      'See https://github.com/bitnami/charts/tree/master/bitnami/postgresql/ for details.'
    );

    expect(html).toContain('href="https://github.com/bitnami/charts/tree/master/bitnami/postgresql/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
  });

  it('strips trailing punctuation from URLs', () => {
    const html = formatDescriptionHtml('More info at https://example.com/docs.');

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('docs</a>.');
  });

  it('does not pull surrounding quotes into the URL', () => {
    const html = formatDescriptionHtml('"https://example.com/docs"');

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toMatch(/["“]?<a [^>]*href="https:\/\/example\.com\/docs"/);
    expect(html).toMatch(/docs<\/a>["”]?/);
    expect(html).not.toMatch(/href="[^"]*&quot;/);
  });

  it('does not pull surrounding angle brackets into the URL', () => {
    const html = formatDescriptionHtml('<https://example.com/docs>');

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('&lt;<a');
    expect(html).toContain('docs</a>&gt;');
    expect(html).not.toMatch(/href="[^"]*&gt;/);
  });

  it('keeps balanced parentheses inside Wikipedia-style URLs', () => {
    const html = formatDescriptionHtml('See https://en.wikipedia.org/wiki/Foo_(bar) please.');

    expect(html).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
    expect(html).toContain('Foo_(bar)</a>');
  });

  it('preserves newlines as breaks', () => {
    const html = formatDescriptionHtml('Line one\nLine two');

    expect(html).toContain('Line one<br>Line two');
  });
});

describe('extractDescriptionLinks', () => {
  it('returns unique URLs from text', () => {
    expect(extractDescriptionLinks(
      'A https://example.com/a and again https://example.com/a plus https://example.com/b'
    )).toEqual(['https://example.com/a', 'https://example.com/b']);
  });

  it('returns empty array when no URLs', () => {
    expect(extractDescriptionLinks('No links here')).toEqual([]);
    expect(extractDescriptionLinks('')).toEqual([]);
  });

  it('matches formatDescriptionHtml URL normalization', () => {
    expect(extractDescriptionLinks('"https://example.com/docs"')).toEqual(['https://example.com/docs']);
    expect(extractDescriptionLinks('<https://example.com/docs>')).toEqual(['https://example.com/docs']);
    expect(extractDescriptionLinks('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual([
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    ]);
  });
});
