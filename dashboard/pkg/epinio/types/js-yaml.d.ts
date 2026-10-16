// js-yaml ships no types and arrives transitively through @rancher/shell.
// Declares only what this package calls, instead of adding @types/js-yaml.
declare module 'js-yaml' {
  export function load(str: string, opts?: Record<string, unknown>): any;
  export function dump(obj: unknown, opts?: Record<string, unknown>): string;

  const jsyaml: { load: typeof load; dump: typeof dump };

  export default jsyaml;
}
