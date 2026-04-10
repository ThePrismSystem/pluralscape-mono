/**
 * Mobile import runner — a thin orchestrator around the engine's `runImport`.
 *
 * Responsibilities:
 *
 * 1. Wrap the engine so the caller does not need to know how to construct
 *    onProgress closures.
 * 2. Drain errors from the `MobilePersister` at every chunk boundary and
 *    push them into `importJob.update` via the injected `updateJobFn`.
 * 3. Translate the engine's terminal outcome into the matching job-status
 *    patch — `completed` with progressPercent 100, or `failed` with the
 *    preserved checkpoint + error log so the user can resume.
 *
 * Design notes:
 *
 * - The runner never talks to tRPC directly. The hook layer injects an
 *   `updateJobFn` that wraps whatever transport (tRPC mutation, REST call)
 *   the caller prefers. This keeps the runner agnostic of React, the tRPC
 *   client, and the API client package.
 * - Progress percent is derived from the number of completed collections
 *   against the total dependency order (SP has 17 collections). We deliberately
 *   do not try to be more accurate — per-document progress is noisy on mobile
 *   networks and would require streaming counts from the engine which is
 *   currently not exposed.
 * - The "version optimism" placeholder (update paths using `version: 1`) from
 *   Phase C carries through unchanged; the runner does not attempt to patch it.
 */

import { DEPENDENCY_ORDER } from "@pluralscape/import-sp/dependency-order";
import {
  collectionToEntityType,
  emptyCheckpointState,
  runImport,
} from "@pluralscape/import-sp/engine";

import type { MobilePersister } from "./mobile-persister.js";
import type { ImportRunResult } from "@pluralscape/import-sp/engine";
import type { ImportDataSource } from "@pluralscape/import-sp/source-types";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportError,
  ImportJobId,
} from "@pluralscape/types";

/** Maximum progressPercent value for a completed import. */
const MAX_PROGRESS_PERCENT = 100;

// ── Public shapes ────────────────────────────────────────────────────

/** Common options a caller supplies to any start-import path. */
export interface ImportStartCommonOptions {
  readonly selectedCategories: Partial<Record<string, boolean>>;
  readonly avatarMode: ImportAvatarMode;
  /** Whether to persist the SP API token to SecureStore after a successful start. */
  readonly persistToken?: boolean;
}

/** A snapshot emitted at every chunk boundary during an import run. */
export interface ImportRunnerProgressSnapshot {
  readonly progressPercent: number;
  readonly checkpointState: ImportCheckpointState;
  readonly errorCount: number;
}

/** Patch shape the runner hands to the caller-supplied `updateJobFn`. */
export interface ImportJobUpdatePatch {
  readonly status?: "pending" | "validating" | "importing" | "completed" | "failed";
  readonly progressPercent?: number;
  readonly chunksCompleted?: number;
  readonly checkpointState?: ImportCheckpointState;
  readonly errorLog?: readonly ImportError[];
}

/** Function signature the runner uses to push state changes to the server. */
export type UpdateJobFn = (importJobId: ImportJobId, patch: ImportJobUpdatePatch) => Promise<void>;

/** Arguments for `runSpImport`. */
export interface RunSpImportArgs {
  readonly source: ImportDataSource;
  readonly persister: MobilePersister;
  readonly importJobId: ImportJobId;
  readonly options: ImportStartCommonOptions;
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly onProgress?: (snapshot: ImportRunnerProgressSnapshot) => void;
  readonly updateJobFn: UpdateJobFn;
  readonly abortSignal?: AbortSignal;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Compute a rough progress percent from the checkpoint's completed
 * collections. This is the same scheme the future wizard UI uses when
 * reading the job row directly — keeping the calculation identical here
 * means mid-run callbacks match the eventual polled snapshot.
 */
function deriveProgressPercent(state: ImportCheckpointState): number {
  const completed = state.checkpoint.completedCollections.length;
  const total = DEPENDENCY_ORDER.length;
  if (total === 0) return 0;
  return Math.min(MAX_PROGRESS_PERCENT, Math.round((completed / total) * MAX_PROGRESS_PERCENT));
}

// ── Runner entry point ───────────────────────────────────────────────

/**
 * Kick off an SP import run and stream progress into `updateJobFn`.
 *
 * Errors thrown by the engine are surfaced through the returned
 * `ImportRunResult.outcome === "aborted"` pathway; the runner never
 * re-throws. Callers that want a promise rejection on failure should
 * check `result.outcome` themselves.
 */
export async function runSpImport(args: RunSpImportArgs): Promise<ImportRunResult> {
  const {
    source,
    persister,
    importJobId,
    options,
    initialCheckpoint,
    onProgress,
    updateJobFn,
    abortSignal,
  } = args;

  // Seed the checkpoint so the job row always has options (selectedCategories,
  // avatarMode) even if the engine never processes a single document.
  const seedState =
    initialCheckpoint ??
    emptyCheckpointState({
      firstEntityType: collectionToEntityType(DEPENDENCY_ORDER[0] ?? "users"),
      selectedCategories: options.selectedCategories,
      avatarMode: options.avatarMode,
    });

  await updateJobFn(importJobId, {
    status: "importing",
    checkpointState: seedState,
  });

  let chunksCompleted = 0;

  async function handleChunkBoundary(state: ImportCheckpointState): Promise<void> {
    chunksCompleted += 1;
    const drainedErrors = persister.drainErrors();
    const progressPercent = deriveProgressPercent(state);
    await updateJobFn(importJobId, {
      status: "importing",
      progressPercent,
      chunksCompleted,
      checkpointState: state,
      errorLog: drainedErrors,
    });
    if (onProgress !== undefined) {
      onProgress({
        progressPercent,
        checkpointState: state,
        errorCount: drainedErrors.length,
      });
    }
  }

  const engineArgs: Parameters<typeof runImport>[0] = {
    source,
    persister,
    options: {
      selectedCategories: options.selectedCategories,
      avatarMode: options.avatarMode,
    },
    onProgress: handleChunkBoundary,
    ...(initialCheckpoint !== undefined ? { initialCheckpoint } : {}),
    ...(abortSignal !== undefined ? { abortSignal } : {}),
  };

  const result = await runImport(engineArgs);

  // If aborted externally, skip the terminal update entirely.
  if (abortSignal?.aborted === true) {
    return result;
  }

  // Engine returned. Translate the final outcome into a terminal patch.
  if (result.outcome === "completed") {
    try {
      await updateJobFn(importJobId, {
        status: "completed",
        progressPercent: MAX_PROGRESS_PERCENT,
        checkpointState: result.finalState,
        errorLog: result.errors,
      });
    } catch {
      persister.drainErrors();
    }
  } else {
    // aborted → failed, preserve checkpoint so the user can resume.
    try {
      await updateJobFn(importJobId, {
        status: "failed",
        checkpointState: result.finalState,
        errorLog: result.errors,
      });
    } catch {
      persister.drainErrors();
    }
  }

  return result;
}
