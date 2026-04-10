/**
 * Journal entry persister.
 *
 * SP `notes` → Pluralscape journal entries. The Pluralscape router name
 * is `note.*` (see `apps/api/src/trpc/routers/note.ts`), and the
 * persister API surface flattens the route to `note.create`/`note.update`.
 *
 * The mapper already resolves the author member FK and wraps the note
 * body in a single paragraph block. The persister simply encrypts and
 * pushes through.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface JournalEntryPayload {
  readonly title: string;
  readonly author: { readonly entityType: "member"; readonly entityId: string };
  readonly blocks: readonly {
    readonly type: "paragraph";
    readonly content: string;
    readonly children: readonly never[];
  }[];
  readonly createdAt: number;
}

function isJournalEntryPayload(value: unknown): value is JournalEntryPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["title"] === "string" && Array.isArray(record["blocks"]);
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isJournalEntryPayload, "journal-entry");
  const encrypted = encryptForCreate(narrowed, ctx.masterKey);
  const result = await ctx.api.note.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isJournalEntryPayload, "journal-entry");
  const encrypted = encryptForUpdate(narrowed, 1, ctx.masterKey);
  const result = await ctx.api.note.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const journalEntryPersister: EntityPersister = { create, update };
