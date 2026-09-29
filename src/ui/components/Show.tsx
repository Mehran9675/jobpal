import type { ReactNode } from 'react';

/**
 * Renders children only when `if` is truthy.
 *
 * Always prefer this over `condition && <X/>` in JSX:
 *   <Show if={state.busy}>{content}</Show>
 */
export function Show({ if: condition, children }: { if: boolean | null | undefined; children: ReactNode }) {
  return condition ? <>{children}</> : null;
}
