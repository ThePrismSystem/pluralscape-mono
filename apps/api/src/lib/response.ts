import type { ActionResult } from "@pluralscape/types";

/** Wrap a data payload in the standard { data } envelope. */
export function wrapResult<T>(data: T): { readonly data: T } {
  return { data };
}

/** Wrap a mutation confirmation in the standard { data: { success: true, ...details } } envelope. */
export function wrapAction(): { readonly data: ActionResult };
export function wrapAction<T extends Record<string, unknown>>(
  details: T,
): { readonly data: ActionResult & T };
export function wrapAction<T extends Record<string, unknown>>(
  details?: T,
): { readonly data: ActionResult & T } | { readonly data: ActionResult } {
  if (details) {
    return { data: { success: true, ...details } };
  }
  return { data: { success: true } };
}
