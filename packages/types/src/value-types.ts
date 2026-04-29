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
 * assigned to the sibling `description` field, or to other UI-label
 * slots — `FieldDefinition.name` is the field's display label and is
 * widely passed as a UI label key, with high confusion risk against
 * content strings.
 */
export type FieldDefinitionLabel = Brand<string, "FieldDefinitionLabel">;

/**
 * Free-text user-supplied note title.
 *
 * Branded distinct from {@link NoteContent} to prevent cross-field
 * assignment between same-entity peers — Note has both `title` and
 * `content` as user-typed strings.
 */
export type NoteTitle = Brand<string, "NoteTitle">;

/**
 * Free-text user-supplied note body.
 * Examples: "Met with therapist today...", "Reminder: pick up groceries".
 *
 * See {@link NoteTitle} for rationale.
 */
export type NoteContent = Brand<string, "NoteContent">;

/**
 * Free-text user-supplied poll title.
 *
 * Branded distinct from {@link PollOptionLabel} to prevent
 * cross-field assignment between the parent poll title and child
 * option labels in poll-edit forms — Poll.title and PollOption.label
 * are both user-typed strings on the same entity tree.
 */
export type PollTitle = Brand<string, "PollTitle">;

/**
 * Free-text user-supplied poll-option label.
 *
 * See {@link PollTitle} for rationale.
 */
export type PollOptionLabel = Brand<string, "PollOptionLabel">;

/**
 * Free-text user-supplied fronting-session status comment.
 *
 * Branded distinct from {@link FrontingSessionPositionality} and
 * {@link FrontingSessionOuttrigger} — three same-entity peers all
 * stored in the FrontingSession encrypted blob with concrete
 * cross-field swap risk.
 */
export type FrontingSessionComment = Brand<string, "FrontingSessionComment">;

/**
 * Free-text user-supplied fronting-session positionality (e.g. close
 * vs far, height).
 *
 * See {@link FrontingSessionComment} for rationale.
 */
export type FrontingSessionPositionality = Brand<string, "FrontingSessionPositionality">;

/**
 * Free-text user-supplied fronting-session outtrigger reason — what
 * caused the fronting change.
 *
 * See {@link FrontingSessionComment} for rationale.
 */
export type FrontingSessionOuttrigger = Brand<string, "FrontingSessionOuttrigger">;

/** Constraint for {@link brandValue} — any string-backed phantom brand. */
type AnyBrandedValue = Brand<string, string>;

/**
 * Cast a plain string to a branded value type. Compile-time only — no
 * runtime cost. Mirrors {@link brandId} for non-ID display labels.
 */
export function brandValue<B extends AnyBrandedValue>(raw: B | string): B {
  return raw as B;
}
