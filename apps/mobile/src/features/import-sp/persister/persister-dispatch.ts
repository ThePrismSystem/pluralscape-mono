/**
 * Dispatch table — maps every `ImportEntityType` to the helper that
 * knows how to persist it.
 *
 * The type `Record<ImportEntityType, EntityPersister>` is the
 * exhaustiveness check: TypeScript will refuse to compile if a new
 * entity type is added to the union without a matching helper.
 *
 * Types the SP import engine never emits (`switch`, `custom-field`,
 * `note`, `timer`, `unknown`) are wired to a shared rejecting helper
 * that throws with a clear message. Replacing any of these with a real
 * persister just requires dropping in the helper import and
 * overwriting the entry.
 *
 * Granularity: each persister lives in its own file, giving one file per
 * `PersistableEntity` variant. That 1:1 mapping is deliberate — each
 * persister owns a distinct SQL upsert / conflict policy and is exercised
 * independently in tests, so merging them into a single dispatch file
 * would bundle unrelated responsibilities and make per-entity edits noisy.
 * Audit review (2026-04-10) explicitly confirmed no consolidation is
 * warranted.
 */

import { boardMessagePersister } from "./board-message.persister.js";
import { channelCategoryPersister } from "./channel-category.persister.js";
import { channelPersister } from "./channel.persister.js";
import { chatMessagePersister } from "./chat-message.persister.js";
import { customFrontPersister } from "./custom-front.persister.js";
import { fieldDefinitionPersister } from "./field-definition.persister.js";
import { fieldValuePersister } from "./field-value.persister.js";
import { frontingCommentPersister } from "./fronting-comment.persister.js";
import { frontingSessionPersister } from "./fronting-session.persister.js";
import { groupPersister } from "./group.persister.js";
import { journalEntryPersister } from "./journal-entry.persister.js";
import { memberPersister } from "./member.persister.js";
import { pollPersister } from "./poll.persister.js";
import { privacyBucketPersister } from "./privacy-bucket.persister.js";
import { systemProfilePersister } from "./system-profile.persister.js";
import { systemSettingsPersister } from "./system-settings.persister.js";

import type {
  EntityPersister,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";
import type { ImportEntityType } from "@pluralscape/types";

/**
 * Helper used for `ImportEntityType` variants the SP engine does not
 * emit. Both `create` and `update` reject with an explicit error so a
 * misconfigured engine surfaces loudly instead of silently dropping
 * rows.
 */
function createRejectingPersister(entityType: ImportEntityType): EntityPersister {
  const message = `SP import does not emit entity type "${entityType}"`;
  return {
    create(): Promise<PersisterCreateResult> {
      return Promise.reject(new Error(message));
    },
    update(): Promise<PersisterUpdateResult> {
      return Promise.reject(new Error(message));
    },
  };
}

/**
 * The dispatch table. Adding a new `ImportEntityType` value to the
 * union forces a typecheck failure here until a helper is added.
 */
export const PERSISTER_DISPATCH: Readonly<Record<ImportEntityType, EntityPersister>> = {
  member: memberPersister,
  group: groupPersister,
  "custom-front": customFrontPersister,
  "fronting-session": frontingSessionPersister,
  "fronting-comment": frontingCommentPersister,
  switch: createRejectingPersister("switch"),
  "custom-field": createRejectingPersister("custom-field"),
  "field-definition": fieldDefinitionPersister,
  "field-value": fieldValuePersister,
  note: createRejectingPersister("note"),
  "journal-entry": journalEntryPersister,
  "chat-message": chatMessagePersister,
  "board-message": boardMessagePersister,
  "channel-category": channelCategoryPersister,
  channel: channelPersister,
  poll: pollPersister,
  timer: createRejectingPersister("timer"),
  "privacy-bucket": privacyBucketPersister,
  "system-profile": systemProfilePersister,
  "system-settings": systemSettingsPersister,
  unknown: createRejectingPersister("unknown"),
};
