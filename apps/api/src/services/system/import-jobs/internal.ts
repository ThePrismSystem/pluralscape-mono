import { importJobs } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { ImportCheckpointStateSchema, ImportErrorSchema } from "@pluralscape/validation";
import { z } from "zod/v4";

import { HTTP_INTERNAL_SERVER_ERROR } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";

import type {
  AccountId,
  ImportCheckpointState,
  ImportError,
  ImportJobId,
  ImportJobStatus,
  ImportSourceFormat,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface ImportJobResult {
  readonly id: ImportJobId;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  readonly status: ImportJobStatus;
  readonly progressPercent: number;
  readonly errorLog: readonly ImportError[] | null;
  readonly warningCount: number;
  readonly chunksTotal: number | null;
  readonly chunksCompleted: number;
  readonly checkpointState: ImportCheckpointState | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly completedAt: UnixMillis | null;
}

// ── JSONB read validators ────────────────────────────────────────────
// Every read of a JSONB column goes through these helpers. Corrupt rows
// (schema drift, stale worker writes, manual SQL) surface as structured
// INTERNAL_ERROR responses rather than returning silently-wrong data.

const ImportErrorLogSchema = z.array(ImportErrorSchema).nullable();

export function parseErrorLog(raw: unknown): readonly ImportError[] | null {
  if (raw === null || raw === undefined) return null;
  const result = ImportErrorLogSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiHttpError(
      HTTP_INTERNAL_SERVER_ERROR,
      "INTERNAL_ERROR",
      "Corrupt import job error log",
      { reason: "corrupt_error_log", issues: result.error.issues },
    );
  }
  return result.data;
}

function parseCheckpointState(raw: unknown): ImportCheckpointState | null {
  if (raw === null || raw === undefined) return null;
  const result = ImportCheckpointStateSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiHttpError(
      HTTP_INTERNAL_SERVER_ERROR,
      "INTERNAL_ERROR",
      "Corrupt import checkpoint state",
      { reason: "corrupt_checkpoint_state", issues: result.error.issues },
    );
  }
  return result.data;
}

export function toImportJobResult(row: typeof importJobs.$inferSelect): ImportJobResult {
  return {
    id: brandId<ImportJobId>(row.id),
    accountId: brandId<AccountId>(row.accountId),
    systemId: brandId<SystemId>(row.systemId),
    source: row.source,
    status: row.status,
    progressPercent: row.progressPercent,
    errorLog: parseErrorLog(row.errorLog),
    warningCount: row.warningCount,
    chunksTotal: row.chunksTotal,
    chunksCompleted: row.chunksCompleted,
    checkpointState: parseCheckpointState(row.checkpointState),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    completedAt: toUnixMillisOrNull(row.completedAt),
  };
}
