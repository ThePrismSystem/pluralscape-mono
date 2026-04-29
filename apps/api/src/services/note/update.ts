import { notes } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toNoteResult } from "./internal.js";

import type { NoteResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { NoteId, SystemId } from "@pluralscape/types";
import type { UpdateNoteBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  body: z.infer<typeof UpdateNoteBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(notes)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${notes.version} + 1`,
      })
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.systemId, systemId),
          eq(notes.version, version),
          eq(notes.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.id, noteId), eq(notes.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Note",
    );

    await audit(tx, {
      eventType: "note.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Note updated",
      systemId,
    });
    const result = toNoteResult(row);
    await dispatchWebhookEvent(tx, systemId, "note.updated", {
      noteId: result.id,
    });

    return result;
  });
}
