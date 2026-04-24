declare module 'js-yaml' {
  export function dump(input: unknown, options?: unknown): string;
  export function load(input: string, options?: unknown): unknown;
}
