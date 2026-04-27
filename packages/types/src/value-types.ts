import type { Brand } from "./ids.js";

/**
 * Free-text user-supplied member-form display label on lifecycle events.
 * Examples: "child age 8", "human male", "wolf", "shadow form".
 *
 * Branded so a `previousForm` value cannot accidentally be assigned to a
 * `previousName` field (or vice versa) — both are `string | null` in raw
 * shape, but cross-field assignment was a real risk surfaced by the
 * type-design reviewer in PR #561.
 */
export type LifecycleEventForm = Brand<string, "LifecycleEventForm">;

/**
 * Free-text user-supplied member-name display label on lifecycle events.
 * Examples: "Alex", "the small one", "K".
 *
 * See {@link LifecycleEventForm} for rationale.
 */
export type LifecycleEventName = Brand<string, "LifecycleEventName">;

/** Constraint for {@link brandValue} — any string-backed phantom brand. */
type AnyBrandedValue = Brand<string, string>;

/**
 * Cast a plain string to a branded value type. Compile-time only — no
 * runtime cost. Mirrors {@link brandId} for non-ID display labels.
 *
 * Callers handle null themselves:
 * ```ts
 * previousForm: raw === null ? null : brandValue<LifecycleEventForm>(raw)
 * ```
 */
export function brandValue<B extends AnyBrandedValue>(raw: B | string): B {
  return raw as B;
}
