/**
 * React hooks for the mobile-side Simply Plural import surface.
 *
 * The wizard UI composes these hooks into the multi-step flow:
 *
 * - `useStartImport` — begins a new import run (either from an SP API token
 *   or an uploaded export file) and kicks `runSpImport` off as a
 *   fire-and-forget promise.
 * - `useImportJob` — reads a single job row by id via
 *   `trpc.importJob.get.useQuery`.
 *
 * Further hooks (`useImportProgress`, `useImportSummary`,
 * `useResumeActiveImport`, `useCancelImport`) are added in subsequent
 * Phase D tasks and live in this file too.
 *
 * Design notes:
 *
 * - The PersisterApi adapter that bridges the engine's persister boundary
 *   to the real tRPC client is intentionally stubbed with a placeholder
 *   at this stage. Phase D's hook tests mock `runSpImport` so the stubs
 *   are never called, and the real wiring is deferred to a follow-up
 *   that can share code with the Plan 3 E2E tests. The stub still
 *   satisfies `PersisterApi`'s structural shape so the hook typechecks.
 * - `startWithToken` and `startWithFile` return the job id immediately
 *   once `importJob.create` resolves. The runner is kicked off via
 *   `void startImportRun(...)` so the hook does not block the caller.
 */

import { trpc } from "@pluralscape/api-client/trpc";
import { useCallback, useState } from "react";

import { useMasterKey } from "../../providers/crypto-provider.js";
import { useActiveSystemId } from "../../providers/system-provider.js";

import { createMobileAvatarFetcher } from "./avatar-fetcher.js";
import {
  type ImportRunnerProgressSnapshot,
  type ImportStartCommonOptions,
  type UpdateJobFn,
  runSpImport,
} from "./import-runner.js";
import { IMPORT_PROGRESS_POLL_INTERVAL_MS } from "./import-sp-mobile.constants.js";
import { createMobilePersister } from "./mobile-persister.js";
import { createSpTokenStorage } from "./sp-token-storage.js";

import type { PersisterApi } from "./persister/persister.types.js";
import type { DataQuery } from "../../hooks/types.js";
import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type { ImportSource } from "@pluralscape/import-sp/source-types";
import type {
  ImportCheckpointState,
  ImportEntityType,
  ImportJob,
  ImportJobId,
  ImportJobStatus,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `trpc.importJob.get.useQuery` — includes `checkpointState`. */
type ImportJobRow = RouterOutput["importJob"]["get"];

// ── Start-import input shapes ────────────────────────────────────────

/** Minimal shape the wizard hands back from `expo-document-picker`. */
export interface DocumentPickerAsset {
  readonly uri: string;
  readonly name: string;
  readonly size?: number;
  readonly mimeType?: string;
}

/** Arguments for `startWithToken`. */
export interface StartWithTokenArgs {
  readonly token: string;
  readonly options: ImportStartCommonOptions;
}

/** Arguments for `startWithFile`. */
export interface StartWithFileArgs {
  readonly jsonAsset: DocumentPickerAsset;
  readonly zipAsset: DocumentPickerAsset | null;
  readonly options: ImportStartCommonOptions;
}

/** Return type of `useStartImport`. */
export interface UseStartImportReturn {
  readonly startWithToken: (args: StartWithTokenArgs) => Promise<ImportJobId>;
  readonly startWithFile: (args: StartWithFileArgs) => Promise<ImportJobId>;
  readonly isStarting: boolean;
}

// ── Placeholder PersisterApi adapter ─────────────────────────────────

/**
 * Produce a `PersisterApi` placeholder that throws on every operation.
 *
 * This exists so `createMobilePersister` can receive a structurally-valid
 * api during hook construction. Production usage will replace this with
 * a real vanilla-tRPC-backed implementation wired to the full Pluralscape
 * schema; until that wiring lands, the hook tests mock `runSpImport`
 * wholesale so the persister's methods are never called. Any code path
 * that reaches these stubs is a bug and deserves to throw loudly.
 */
function createPlaceholderPersisterApi(): PersisterApi {
  const notWired = (path: string): (() => never) => {
    return () => {
      throw new Error(`PersisterApi.${path} is not wired yet (Phase D placeholder)`);
    };
  };
  return {
    system: {
      getCurrentVersion: notWired("system.getCurrentVersion"),
      update: notWired("system.update"),
    },
    systemSettings: {
      getCurrentVersion: notWired("systemSettings.getCurrentVersion"),
      update: notWired("systemSettings.update"),
    },
    bucket: { create: notWired("bucket.create"), update: notWired("bucket.update") },
    field: {
      create: notWired("field.create"),
      update: notWired("field.update"),
      setValue: notWired("field.setValue"),
    },
    customFront: {
      create: notWired("customFront.create"),
      update: notWired("customFront.update"),
    },
    member: { create: notWired("member.create"), update: notWired("member.update") },
    friend: { recordExternalReference: notWired("friend.recordExternalReference") },
    frontingSession: {
      create: notWired("frontingSession.create"),
      update: notWired("frontingSession.update"),
    },
    frontingComment: {
      create: notWired("frontingComment.create"),
      update: notWired("frontingComment.update"),
    },
    note: { create: notWired("note.create"), update: notWired("note.update") },
    poll: {
      create: notWired("poll.create"),
      update: notWired("poll.update"),
      castVote: notWired("poll.castVote"),
    },
    channel: { create: notWired("channel.create"), update: notWired("channel.update") },
    message: { create: notWired("message.create"), update: notWired("message.update") },
    boardMessage: {
      create: notWired("boardMessage.create"),
      update: notWired("boardMessage.update"),
    },
    group: { create: notWired("group.create"), update: notWired("group.update") },
    blob: { uploadAvatar: notWired("blob.uploadAvatar") },
    importEntityRef: {
      lookupBatch: notWired("importEntityRef.lookupBatch"),
      upsertBatch: notWired("importEntityRef.upsertBatch"),
    },
  };
}

// ── Placeholder source used until Phase E wires real source creation ──

/**
 * Build a no-op `ImportSource` of the requested mode. The hook returns
 * this so `runSpImport` has a valid engine collaborator even when the
 * hook tests mock `runSpImport` entirely — exercising the real source
 * factories from the hook happens in Phase E.
 */
function createPlaceholderSource(mode: "api" | "file"): ImportSource {
  return {
    mode,
    async *iterate() {
      await Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
}

// ── Orchestration helper ─────────────────────────────────────────────

interface StartOrchestrationArgs {
  readonly importJobId: ImportJobId;
  readonly systemId: SystemId;
  readonly masterKey: KdfMasterKey;
  readonly source: ImportSource;
  readonly avatarFetcher: AvatarFetcher;
  readonly options: ImportStartCommonOptions;
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly onProgress?: (snapshot: ImportRunnerProgressSnapshot) => void;
  readonly updateJobFn: UpdateJobFn;
}

async function startImportRun(args: StartOrchestrationArgs): Promise<void> {
  const api = createPlaceholderPersisterApi();
  const persister = createMobilePersister({
    systemId: args.systemId,
    source: "simply-plural",
    masterKey: args.masterKey,
    api,
    avatarFetcher: args.avatarFetcher,
    preloadHints: [],
  });
  await runSpImport({
    source: args.source,
    persister,
    importJobId: args.importJobId,
    options: args.options,
    ...(args.initialCheckpoint !== undefined ? { initialCheckpoint: args.initialCheckpoint } : {}),
    ...(args.onProgress !== undefined ? { onProgress: args.onProgress } : {}),
    updateJobFn: args.updateJobFn,
  });
}

// ── useStartImport ───────────────────────────────────────────────────

/**
 * Hook exposing the two entry points the wizard UI uses to begin an SP
 * import: via an API token or via an uploaded export file.
 *
 * The returned `startWith*` callbacks create a pending job via
 * `importJob.create`, optionally persist the token, assemble the engine
 * collaborators, and kick `runSpImport` off as a fire-and-forget promise.
 * The job id is returned immediately so the wizard can route to the
 * progress screen while the runner continues in the background.
 */
export function useStartImport(): UseStartImportReturn {
  const activeSystemId = useActiveSystemId();
  const masterKey = useMasterKey();
  const createJobMutation = trpc.importJob.create.useMutation();
  const updateJobMutation = trpc.importJob.update.useMutation();
  const updateJobAsync = updateJobMutation.mutateAsync;

  const updateJobFn: UpdateJobFn = useCallback(
    async (importJobId, patch) => {
      // The runner emits readonly arrays inside `checkpointState` and
      // `errorLog`; Zod-inferred mutation inputs are structurally mutable
      // so we shallow-clone the collections that carry readonly arrays
      // before handing them to the mutation.
      const { errorLog, checkpointState, ...rest } = patch;
      const checkpointClone =
        checkpointState !== undefined
          ? {
              ...checkpointState,
              checkpoint: {
                ...checkpointState.checkpoint,
                completedCollections: [...checkpointState.checkpoint.completedCollections],
              },
            }
          : undefined;
      await updateJobAsync({
        systemId: activeSystemId,
        importJobId,
        ...rest,
        ...(errorLog !== undefined ? { errorLog: [...errorLog] } : {}),
        ...(checkpointClone !== undefined ? { checkpointState: checkpointClone } : {}),
      });
    },
    [activeSystemId, updateJobAsync],
  );

  const [isStarting, setIsStarting] = useState(false);

  const createJobAsync = createJobMutation.mutateAsync;

  const startWithToken = useCallback(
    async (args: StartWithTokenArgs): Promise<ImportJobId> => {
      if (masterKey === null) {
        throw new Error("useStartImport requires an unlocked crypto provider");
      }
      setIsStarting(true);
      try {
        const job = await createJobAsync({
          systemId: activeSystemId,
          source: "simply-plural",
          selectedCategories: args.options.selectedCategories,
          avatarMode: args.options.avatarMode,
        });
        if (args.options.persistToken === true) {
          const storage = createSpTokenStorage();
          await storage.set(job.systemId, args.token);
        }
        void startImportRun({
          importJobId: job.id,
          systemId: job.systemId,
          masterKey,
          source: createPlaceholderSource("api"),
          avatarFetcher: createMobileAvatarFetcher({
            mode: args.options.avatarMode === "api" ? "api" : "skip",
          }),
          options: args.options,
          updateJobFn,
        });
        return job.id;
      } finally {
        setIsStarting(false);
      }
    },
    [activeSystemId, createJobAsync, masterKey, updateJobFn],
  );

  const startWithFile = useCallback(
    async (args: StartWithFileArgs): Promise<ImportJobId> => {
      if (masterKey === null) {
        throw new Error("useStartImport requires an unlocked crypto provider");
      }
      setIsStarting(true);
      try {
        const job = await createJobAsync({
          systemId: activeSystemId,
          source: "simply-plural",
          selectedCategories: args.options.selectedCategories,
          avatarMode: args.options.avatarMode,
        });
        void startImportRun({
          importJobId: job.id,
          systemId: job.systemId,
          masterKey,
          source: createPlaceholderSource("file"),
          avatarFetcher: createMobileAvatarFetcher({ mode: "skip" }),
          options: args.options,
          updateJobFn,
        });
        return job.id;
      } finally {
        setIsStarting(false);
      }
    },
    [activeSystemId, createJobAsync, masterKey, updateJobFn],
  );

  return {
    startWithToken,
    startWithFile,
    isStarting,
  };
}

// ── useImportJob ─────────────────────────────────────────────────────

/**
 * Read a single import job row by id. Returns a disabled query when
 * `jobId` is `null` so callers can gracefully render a pre-start state.
 */
export function useImportJob(jobId: ImportJobId | null): DataQuery<ImportJob> {
  const activeSystemId = useActiveSystemId();
  return trpc.importJob.get.useQuery(
    { systemId: activeSystemId, importJobId: jobId ?? ("ij_placeholder" as ImportJobId) },
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
    { systemId: activeSystemId, importJobId: jobId ?? ("ij_placeholder" as ImportJobId) },
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

/**
 * Build the derived snapshot from a raw job row.
 */
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
