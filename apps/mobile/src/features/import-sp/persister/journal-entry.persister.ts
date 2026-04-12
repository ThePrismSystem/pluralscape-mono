/**
 * Journal entry persister.
 *
 * SP `notes` → Pluralscape journal entries. The Pluralscape router name
 * is `note.*` (see `apps/api/src/trpc/routers/note.ts`), and the
 * persister API surface flattens the route to `note.create`/`note.update`.
 *
 * The mapper already resolves the author member FK and wraps the note
 * body in the content field. The persister simply encrypts and pushes
 * through.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface JournalEntryPayload {
  readonly encrypted: {
    readonly title: string;
    readonly content: string;
    readonly backgroundColor: string | null;
  };
  readonly author?: { readonly entityType: "member"; readonly entityId: string } | null;
  readonly createdAt: number;
}

function isJournalEntryPayload(value: unknown): value is JournalEntryPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["title"] === "string" && typeof encrypted["content"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isJournalEntryPayload, "journal-entry");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.note.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    author: narrowed.author ?? null,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isJournalEntryPayload, "journal-entry");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.note.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const journalEntryPersister: EntityPersister = { create, update };
