import type { Brand } from "./ids.js";

/**
 * Free-text user-supplied member-form display label on lifecycle events.
 * Examples: "child age 8", "human male", "wolf", "shadow form".
 *
 * Branded so a `previousForm` value cannot accidentally be assigned to a
 * `previousName` field (or vice versa) — both are `string | null` in raw
 * shape, and cross-field assignment is a real risk this brand prevents at
 * compile time.
 */
export type LifecycleEventForm = Brand<string, "LifecycleEventForm">;

/**
 * Free-text user-supplied member-name display label on lifecycle events.
 * Examples: "Alex", "the small one", "K".
 *
 * See {@link LifecycleEventForm} for rationale.
 */
export type LifecycleEventName = Brand<string, "LifecycleEventName">;

/**
 * Free-text user-supplied field-definition display label.
 * Examples: "Pronouns", "Age", "Job".
 *
 * Branded so a `FieldDefinition.name` value cannot accidentally be
 * assigned to other free-text slots — `FieldDefinition.name` is the
 * field's display label and is widely passed as a UI label key, with
 * high confusion risk against content strings. See
 * docs/local-audits/2026-04-27-free-text-label-brand-audit.md.
 */
export type FieldDefinitionLabel = Brand<string, "FieldDefinitionLabel">;

/** Constraint for {@link brandValue} — any string-backed phantom brand. */
type AnyBrandedValue = Brand<string, string>;

/**
 * Cast a plain string to a branded value type. Compile-time only — no
 * runtime cost. Mirrors {@link brandId} for non-ID display labels.
 */
export function brandValue<B extends AnyBrandedValue>(raw: B | string): B {
  return raw as B;
}
