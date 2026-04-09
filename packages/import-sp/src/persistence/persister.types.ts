/**
 * Persister boundary types.
 *
 * `PersistableEntity` is a mapped discriminated union — every variant carries
 * an `entityType` discriminator and a strongly-typed `payload` matching the
 * mapper output for that entity type. Consumers narrow on `entityType` to
 * access the typed payload without casts.
 *
 * Field values are intentionally NOT a variant of the union: the field-value
 * mapper extracts values embedded in SP's member document and hands them to
 * the member persister inline via {@link MappedMember.fieldValues}. They are
 * never upserted as standalone entities through the engine's iteration loop.
 */
import type { MappedBoardMessage } from "../mappers/board-message.mapper.js";
import type { MappedPrivacyBucket } from "../mappers/bucket.mapper.js";
import type { MappedChannel, MappedChannelCategory } from "../mappers/channel.mapper.js";
import type { MappedChatMessage } from "../mappers/chat-message.mapper.js";
import type { MappedCustomFront } from "../mappers/custom-front.mapper.js";
import type { MappedFieldDefinition } from "../mappers/field-definition.mapper.js";
import type { MappedFrontingComment } from "../mappers/fronting-comment.mapper.js";
import type { MappedFrontingSession } from "../mappers/fronting-session.mapper.js";
import type { MappedGroup } from "../mappers/group.mapper.js";
import type { MappedJournalEntry } from "../mappers/journal-entry.mapper.js";
import type { MappedMember } from "../mappers/member.mapper.js";
import type { MappedPoll } from "../mappers/poll.mapper.js";
import type { MappedSystemProfile } from "../mappers/system-profile.mapper.js";
import type { MappedSystemSettings } from "../mappers/system-settings.mapper.js";
import type { ImportError, ImportSourceFormat } from "@pluralscape/types";

interface PersistableEntityBase {
  readonly sourceEntityId: string;
  readonly source: ImportSourceFormat;
}

/**
 * Discriminated union of every payload shape the engine upserts through the
 * {@link Persister} interface. The `entityType` tag narrows `payload` to the
 * matching `Mapped<Entity>` type without any casts on consumer sites.
 */
export type PersistableEntity =
  | (PersistableEntityBase & { readonly entityType: "member"; readonly payload: MappedMember })
  | (PersistableEntityBase & { readonly entityType: "group"; readonly payload: MappedGroup })
  | (PersistableEntityBase & {
      readonly entityType: "privacy-bucket";
      readonly payload: MappedPrivacyBucket;
    })
  | (PersistableEntityBase & {
      readonly entityType: "custom-front";
      readonly payload: MappedCustomFront;
    })
  | (PersistableEntityBase & {
      readonly entityType: "field-definition";
      readonly payload: MappedFieldDefinition;
    })
  | (PersistableEntityBase & {
      readonly entityType: "fronting-session";
      readonly payload: MappedFrontingSession;
    })
  | (PersistableEntityBase & {
      readonly entityType: "fronting-comment";
      readonly payload: MappedFrontingComment;
    })
  | (PersistableEntityBase & {
      readonly entityType: "journal-entry";
      readonly payload: MappedJournalEntry;
    })
  | (PersistableEntityBase & { readonly entityType: "poll"; readonly payload: MappedPoll })
  | (PersistableEntityBase & {
      readonly entityType: "channel-category";
      readonly payload: MappedChannelCategory;
    })
  | (PersistableEntityBase & { readonly entityType: "channel"; readonly payload: MappedChannel })
  | (PersistableEntityBase & {
      readonly entityType: "chat-message";
      readonly payload: MappedChatMessage;
    })
  | (PersistableEntityBase & {
      readonly entityType: "board-message";
      readonly payload: MappedBoardMessage;
    })
  | (PersistableEntityBase & {
      readonly entityType: "system-profile";
      readonly payload: MappedSystemProfile;
    })
  | (PersistableEntityBase & {
      readonly entityType: "system-settings";
      readonly payload: MappedSystemSettings;
    });

/** Every `entityType` discriminant present in {@link PersistableEntity}. */
export type PersistableEntityType = PersistableEntity["entityType"];

/**
 * The result of a persister upsert call.
 *
 * - `created`: a new Pluralscape entity was inserted.
 * - `updated`: an existing entity (matched via the IdTranslationTable) was updated.
 * - `skipped`: the persister determined no write was necessary (e.g., identical content).
 */
export type PersisterUpsertAction = "created" | "updated" | "skipped";

export interface PersisterUpsertResult {
  readonly action: PersisterUpsertAction;
  readonly pluralscapeEntityId: string;
}

/**
 * Hook the engine uses to persist mapped entities and record errors.
 *
 * Implementations live outside this package (mobile glue in Plan 3, fakes in
 * tests). The engine never knows whether persistence is encrypted local
 * SQLite, an in-memory map, or a remote API.
 *
 * Contract:
 * - `upsertEntity` MUST be idempotent keyed on `(entityType, sourceEntityId)`.
 *   Content-identical re-upserts SHOULD return `action: "skipped"` so the
 *   engine can report no-op work accurately.
 * - `recordError` MUST NOT throw — error recording must always succeed.
 * - `flush` is called at chunk boundaries; implementations should commit any
 *   buffered writes (e.g., batched ref upserts) before resolving.
 */
export interface Persister {
  upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}
