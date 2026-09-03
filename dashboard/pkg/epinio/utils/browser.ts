/*
* Epinio-owned replacements for the small Rancher Shell utility functions
* used by the log/terminal dock tabs (ApplicationLogs.vue, ApplicationShell.vue).
* Native Web APIs only, no new dependencies.
*/

export type QueryParams = Record<string, string | null>;

export function addParams(url: string, params: QueryParams): string {
  if (!params || typeof params !== 'object') {
    return url;
  }

  let out = url;

  Object.keys(params).forEach((key) => {
    const val = params[key];

    out += out.includes('?') ? '&' : '?';
    out += val === null ? encodeURIComponent(key) : `${ encodeURIComponent(key) }=${ encodeURIComponent(val) }`;
  });

  return out;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

export function escapeHtml(html: string): string {
  return String(html).replace(/[&<>"'/]/g, (char) => HTML_ENTITY_MAP[char]);
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function allHash<T extends Record<string, Promise<any>>>(hash: T): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(hash);
  const values = await Promise.all(Object.values(hash));
  const out: any = {};

  keys.forEach((key, i) => { out[key] = values[i]; });

  return out;
}

// Matches @rancher/shell's Buffer-based base64Encode/Decode (default,
// non-URL-safe alphabet) but via native TextEncoder/TextDecoder + atob/btoa
// instead of the `buffer` polyfill, so terminal input/output round-trips
// UTF-8 correctly without pulling in another dependency.
export function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';

  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });

  return btoa(binary);
}

export function base64Decode(input: string): string {
  const normalized = input.replace(/[-_]/g, (char) => (char === '-' ? '+' : '/'));
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

export function downloadFile(fileName: string, content: string, contentType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}
