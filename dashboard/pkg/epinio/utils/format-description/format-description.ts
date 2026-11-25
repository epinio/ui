import { purifyHTML } from '../../directives/clean-html';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

type TextPart = { type: 'text'; value: string } | { type: 'url'; value: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countChar(text: string, char: string): number {
  let count = 0;

  for (const c of text) {
    if (c === char) {
      count += 1;
    }
  }

  return count;
}

/**
 * Peel sentence punctuation from a URL match. Trailing `)` is kept when it
 * balances an opening `(` in the URL (e.g. Wikipedia Foo_(bar)).
 */
export function normalizeUrlMatch(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';

  while (/[.,;:]$/.test(url)) {
    trailing = `${ url.slice(-1) }${ trailing }`;
    url = url.slice(0, -1);
  }

  while (url.endsWith(')')) {
    if (countChar(url, ')') > countChar(url, '(')) {
      trailing = `)${ trailing }`;
      url = url.slice(0, -1);
    } else {
      break;
    }
  }

  return { url, trailing };
}

function splitTextAndUrls(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    parts.push({ type: 'url', value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function escapeWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * Turns plain catalog/service description text into safe HTML:
 * splits raw URL/non-URL segments first, escapes each separately,
 * linkifies http(s) URLs, preserves newlines.
 */
export function formatDescriptionHtml(text?: string | null): string {
  if (!text) {
    return '';
  }

  const html = splitTextAndUrls(text).map((part) => {
    if (part.type === 'text') {
      return escapeWithBreaks(part.value);
    }

    const { url, trailing } = normalizeUrlMatch(part.value);
    const safeUrl = escapeHtml(url);

    return `<a href="${ safeUrl }" target="_blank" rel="noopener noreferrer nofollow">${ safeUrl }</a>${ escapeWithBreaks(trailing) }`;
  }).join('');

  return purifyHTML(html);
}

/**
 * Returns unique http(s) URLs found in plain description text.
 */
export function extractDescriptionLinks(text?: string | null): string[] {
  if (!text) {
    return [];
  }

  const matches = [...text.matchAll(URL_PATTERN)].map((match) => normalizeUrlMatch(match[0]).url);

  return [...new Set(matches)];
}
