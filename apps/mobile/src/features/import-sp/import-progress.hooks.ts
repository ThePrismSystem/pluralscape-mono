/**
 * Read-only React hooks for the SP import progress and summary UI.
 *
 * Extracted from `import.hooks.ts` to keep the orchestrator file under the
 * area LOC ceiling. These hooks are a slice of `import.hooks.ts`'s public
 * surface and continue to be re-exported from there for callers that import
 * the whole module.
 */
import { trpc } from "@pluralscape/api-client/trpc";
import { brandId } from "@pluralscape/types";

import { useActiveSystemId } from "../../providers/system-provider.js";

import { IMPORT_PROGRESS_POLL_INTERVAL_MS } from "./import-sp-mobile.constants.js";

import type { DataQuery } from "../../hooks/types.js";
import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ImportCheckpointState,
  ImportEntityType,
  ImportError,
  ImportJob,
  ImportJobId,
  ImportJobStatus,
} from "@pluralscape/types";

/** Shape returned by `trpc.importJob.get.useQuery` — includes `checkpointState`. */
type ImportJobRow = RouterOutput["importJob"]["get"];

// ── useImportJob ─────────────────────────────────────────────────────

export function useImportJob(jobId: ImportJobId | null): DataQuery<ImportJob> {
  const activeSystemId = useActiveSystemId();
  return trpc.importJob.get.useQuery(
    { systemId: activeSystemId, importJobId: jobId ?? brandId<ImportJobId>("ij_placeholder") },
    { enabled: jobId !== null },
  ) as DataQuery<ImportJob>;
}

// ── useImportProgress ────────────────────────────────────────────────

/**
 * A derived snapshot of an in-progress SP import, suitable for driving a
 * progress bar + summary counters on the wizard's progress screen.
 */
export interface ImportProgressSnapshot {
  readonly progressPercent: number;
  readonly currentCollection: ImportEntityType | null;
  readonly processedItems: number;
  readonly totalItems: number;
  readonly errorCount: number;
  readonly status: ImportJobStatus;
}

/** Terminal statuses for which progress polling should stop. */
const TERMINAL_STATUSES: readonly ImportJobStatus[] = ["completed", "failed"];

function isTerminalStatus(status: ImportJobStatus | undefined): boolean {
  if (status === undefined) return false;
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Sum per-collection totals to produce a single `processedItems` value
 * (imported + updated + skipped) and a single `totalItems` value (sum of
 * the declared `total` fields).
 */
function sumTotals(state: ImportCheckpointState | null | undefined): {
  processedItems: number;
  totalItems: number;
} {
  if (state === null || state === undefined) return { processedItems: 0, totalItems: 0 };
  let processed = 0;
  let total = 0;
  for (const entry of Object.values(state.totals.perCollection)) {
    processed += entry.imported + entry.updated + entry.skipped;
    total += entry.total;
  }
  return { processedItems: processed, totalItems: total };
}

/**
 * Poll the job row and expose a derived progress snapshot.
 *
 * Polling runs at `IMPORT_PROGRESS_POLL_INTERVAL_MS` while the job is in a
 * non-terminal state and stops as soon as the job reaches `completed` or
 * `failed`. Returns `null` when `jobId` is `null` or the first fetch has
 * not yet produced a row.
 */
export function useImportProgress(jobId: ImportJobId | null): ImportProgressSnapshot | null {
  const activeSystemId = useActiveSystemId();
  const query = trpc.importJob.get.useQuery(
    { systemId: activeSystemId, importJobId: jobId ?? brandId<ImportJobId>("ij_placeholder") },
    {
      enabled: jobId !== null,
      refetchInterval: (q): number | false => {
        const data = q.state.data;
        return isTerminalStatus(data?.status) ? false : IMPORT_PROGRESS_POLL_INTERVAL_MS;
      },
    },
  );

  const job = query.data;
  if (jobId === null || job === undefined) return null;
  return deriveProgressSnapshot(job);
}

/** Build the derived snapshot from a raw job row. */
function deriveProgressSnapshot(job: ImportJobRow): ImportProgressSnapshot {
  const errorCount = job.errorLog?.length ?? 0;
  const checkpointState = job.checkpointState;
  const { processedItems, totalItems } = sumTotals(checkpointState);
  const currentCollection = checkpointState?.checkpoint.currentCollection ?? null;
  return {
    progressPercent: job.progressPercent,
    currentCollection,
    processedItems,
    totalItems,
    errorCount,
    status: job.status,
  };
}

// ── useImportSummary ─────────────────────────────────────────────────

/**
 * A post-run summary of an SP import, suitable for the wizard's "done"
 * screen. `perCollection` mirrors the engine's checkpoint totals so callers
 * can list imported/updated/skipped/failed counts per entity type; `errors`
 * is the full non-fatal error log; `completedAt` is `null` for failed runs.
 */
export interface ImportSummary {
  readonly perCollection: ImportCheckpointState["totals"]["perCollection"];
  readonly errors: readonly ImportError[];
  readonly status: ImportJobStatus;
  readonly completedAt: number | null;
}

/**
 * Read a terminal import job and derive a summary suitable for the wizard's
 * done screen. Returns `null` while the first fetch is in flight or when
 * `jobId` is `null`.
 */
export function useImportSummary(jobId: ImportJobId | null): ImportSummary | null {
  const activeSystemId = useActiveSystemId();
  const query = trpc.importJob.get.useQuery(
    { systemId: activeSystemId, importJobId: jobId ?? brandId<ImportJobId>("ij_placeholder") },
    { enabled: jobId !== null },
  );
  const job = query.data;
  if (jobId === null || job === undefined) return null;
  return {
    perCollection: job.checkpointState?.totals.perCollection ?? {},
    errors: job.errorLog ?? [],
    status: job.status,
    completedAt: job.completedAt,
  };
}
