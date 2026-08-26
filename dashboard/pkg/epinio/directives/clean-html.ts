import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'center', 'code', 'li', 'a', 'p', 'b', 'br', 'ul', 'pre', 'span', 'div',
  'i', 'img', 'em', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tr', 'th', 'tbody', 'td', 'blockquote',
];

// Reverse-tabnabbing hardening: a target=_blank anchor that keeps its target
// needs rel=noopener/noreferrer, or the opened page gets a handle back to
// window.opener.
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.tagName === 'A' && data.attrName === 'target' && data.attrValue === '_blank') {
    data.forceKeepAttr = true;
  }
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && (node as HTMLAnchorElement).target === '_blank') {
    const rel = ['noopener', 'noreferrer', 'nofollow'];
    const existingRel = node.getAttribute('rel')?.split(' ') || [];

    node.setAttribute('rel', [...new Set([...rel, ...existingRel])].join(' '));
  }
});

export const purifyHTML = (value: string): string => DOMPurify.sanitize(value, { ALLOWED_TAGS });

const cleanHtmlDirective = {
  mounted(el: HTMLElement, binding: { value: string }) {
    el.innerHTML = purifyHTML(binding.value);
  },
  updated(el: HTMLElement, binding: { value: string }) {
    el.innerHTML = purifyHTML(binding.value);
  },
  unmounted(el: HTMLElement) {
    el.innerHTML = '';
  },
};

export default cleanHtmlDirective;
