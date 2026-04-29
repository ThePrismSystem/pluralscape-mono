import { notes, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, brandId } from "@pluralscape/types";
import { CreateNoteBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_NOTES_PER_SYSTEM } from "../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toNoteResult } from "./internal.js";

import type { NoteResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AnyBrandedId, NoteId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateNoteBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const noteId = brandId<NoteId>(createId(ID_PREFIXES.note));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system note quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(notes)
      .where(and(eq(notes.systemId, systemId), eq(notes.archived, false)));

    if ((existingCount?.count ?? 0) >= MAX_NOTES_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_NOTES_PER_SYSTEM)} notes per system`,
      );
    }

    const [row] = await tx
      .insert(notes)
      .values({
        id: noteId,
        systemId,
        authorEntityType: parsed.author?.entityType ?? null,
        authorEntityId:
          parsed.author?.entityId === undefined
            ? null
            : brandId<AnyBrandedId>(parsed.author.entityId),
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create note — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "note.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Note created",
      systemId,
    });
    const result = toNoteResult(row);
    await dispatchWebhookEvent(tx, systemId, "note.created", {
      noteId: result.id,
    });

    return result;
  });
}
