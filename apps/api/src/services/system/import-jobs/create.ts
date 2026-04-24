import { importJobs } from "@pluralscape/db/pg";
import {
  ID_PREFIXES,
  IMPORT_CHECKPOINT_SCHEMA_VERSION,
  brandId,
  createId,
  now,
} from "@pluralscape/types";
import { CreateImportJobBodySchema } from "@pluralscape/validation";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";

import { toImportJobResult } from "./internal.js";

import type { ImportJobResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  ImportCheckpointState,
  ImportCollectionType,
  ImportJobId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Canonical order for deciding which collection to start on when seeding
 *  the initial checkpoint. First TRUE entry in this order wins.
 *
 *  `satisfies readonly ImportCollectionType[]` catches membership drift if
 *  `ImportCollectionType` gains a value that isn't listed here — TypeScript
 *  will complain at this declaration rather than at a distant caller. */
const CANONICAL_COLLECTION_ORDER = [
  "member",
  "group",
  "fronting-session",
  "switch",
  "custom-field",
  "note",
  "chat-message",
  "board-message",
  "poll",
  "timer",
  "privacy-bucket",
] as const satisfies readonly ImportCollectionType[];

function firstSelectedCollection(
  selected: Partial<Record<ImportCollectionType, boolean>>,
): ImportCollectionType {
  for (const collection of CANONICAL_COLLECTION_ORDER) {
    if (selected[collection] === true) return collection;
  }
  // Zod .refine() already rejects empty category maps; this is defensive.
  throw new ApiHttpError(
    HTTP_BAD_REQUEST,
    "VALIDATION_ERROR",
    "At least one category must be selected",
  );
}

export async function createImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<ImportJobResult> {
  assertSystemOwnership(systemId, auth);
  const parseResult = CreateImportJobBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body", {
      issues: parseResult.error.issues,
    });
  }
  const parsed = parseResult.data;

  const id = brandId<ImportJobId>(createId(ID_PREFIXES.importJob));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const initialCheckpoint: ImportCheckpointState = {
      schemaVersion: IMPORT_CHECKPOINT_SCHEMA_VERSION,
      checkpoint: {
        completedCollections: [],
        currentCollection: firstSelectedCollection(parsed.selectedCategories),
        currentCollectionLastSourceId: null,
        realPrivacyBucketsMapped: false,
      },
      options: {
        selectedCategories: parsed.selectedCategories,
        avatarMode: parsed.avatarMode,
      },
      totals: { perCollection: {} },
    };

    const [row] = await tx
      .insert(importJobs)
      .values({
        id,
        accountId: auth.accountId,
        systemId,
        source: parsed.source,
        status: "pending",
        progressPercent: 0,
        warningCount: 0,
        chunksCompleted: 0,
        checkpointState: initialCheckpoint,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create import job — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "import-job.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Import job created (source: ${parsed.source})`,
      systemId,
    });

    return toImportJobResult(row);
  });
}
