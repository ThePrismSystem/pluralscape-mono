import type { CrdtChannel, CrdtChatMessage } from "./chat.js";
import type { CrdtFrontingSession } from "./fronting.js";
import type { CrdtJournalEntry } from "./journal.js";
import type { CrdtNote } from "./notes.js";
import type {
  CrdtCustomFront,
  CrdtFieldDefinition,
  CrdtFieldValue,
  CrdtGroup,
  CrdtMember,
  CrdtMemberPhoto,
} from "./system-core.js";

/**
 * Automerge document schema for a bucket projection document.
 *
 * Bucket documents contain write-time fan-out projections — filtered, re-encrypted
 * copies of entities from master-key documents that are visible within a given
 * bucket's scope. This allows friends (with the bucket key) to access the data
 * without access to the master key.
 *
 * Each scope corresponds to a BucketVisibilityScope value in the domain types.
 * Only entities whose BucketContentTag assignments include this bucket are present.
 *
 * Encryption key: Per-bucket key (BucketKey)
 * Naming: bucket-{bucketId}
 */
export interface BucketProjectionDocument {
  /** scope: "members" — projected member profiles (filtered fields). */
  members: Record<string, CrdtMember>;
  /** scope: "member-photos" — projected member photo metadata. */
  memberPhotos: Record<string, CrdtMemberPhoto>;
  /** scope: "groups" — projected groups. */
  groups: Record<string, CrdtGroup>;
  /** scope: "custom-fronts" — projected custom fronts. */
  customFronts: Record<string, CrdtCustomFront>;
  /** scope: "custom-fields" — projected field definitions. */
  fieldDefinitions: Record<string, CrdtFieldDefinition>;
  /** scope: "custom-fields" — projected field values. */
  fieldValues: Record<string, CrdtFieldValue>;
  /** scope: "fronting-status" — active fronting sessions only. */
  frontingSessions: Record<string, CrdtFrontingSession>;
  /** scope: "notes" — projected notes. */
  notes: Record<string, CrdtNote>;
  /** scope: "journal-entries" — projected journal entries. */
  journalEntries: Record<string, CrdtJournalEntry>;
  /** scope: "chat" — projected channel metadata. */
  channels: Record<string, CrdtChannel>;
  /** scope: "chat" — projected chat messages (append-only). */
  messages: CrdtChatMessage[];
}
