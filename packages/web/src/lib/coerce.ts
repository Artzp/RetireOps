/**
 * String coercion for values whose static type is `unknown` — typically
 * loosely-typed form state or server JSON read through a `Record<string, unknown>`.
 *
 * Plain `String(value)` on such a value is a latent bug: if the value is ever an
 * object or array it silently stringifies to `"[object Object]"` (flagged by
 * ESLint `@typescript-eslint/no-base-to-string`). `asString` coerces only the
 * primitive cases and falls back otherwise, so a malformed value can never leak a
 * corrupt `"[object Object]"` id, label, or lookup key into the UI.
 *
 * Pair it with a nullish-coalescing chain to preserve "first defined wins"
 * semantics, e.g. `asString(card._serverId ?? card.id)` or
 * `asString(card.label ?? card.name, 'Account')`.
 */
export function asString(value: unknown, fallback = ''): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      // null | undefined | object | symbol | function — never a meaningful label
      return fallback;
  }
}

/**
 * Numeric coercion for values whose static type is `unknown` — the number-typed
 * sibling of {@link asString}, for loosely-typed form state or server JSON read
 * through a `Record<string, unknown>`. Returns `fallback` when the value does not
 * coerce to a finite number (NaN), so a malformed value can never leak `NaN`
 * into a calculation or numeric input.
 */
export function numVal(value: unknown, fallback: number): number {
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}
