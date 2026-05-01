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
 * - `useResumeActiveImport` — discovers and resumes an in-flight import
 *   from the persisted checkpoint.
 * - `useCancelImport` — aborts a running import and marks the job as
 *   cancelled.
 *
 * Design notes:
 *
 * - The PersisterApi adapter is backed by `createTRPCPersisterApi`, which
 *   bridges the engine's persister boundary to the vanilla tRPC client
 *   obtained from `trpc.useUtils().client`.
 * - `startWithToken` and `startWithFile` return the job id immediately
 *   once `importJob.create` resolves. The runner is kicked off via
 *   `void startImportRun(...)` so the hook does not block the caller.
 */

import { trpc } from "@pluralscape/api-client/trpc";
import { createTRPCClientProxy } from "@trpc/client";
import React, { useCallback, useMemo, useRef, useState } from "react";

import { useMasterKey } from "../../providers/crypto-provider.js";
import { useActiveSystemId } from "../../providers/system-provider.js";

import { createMobileAvatarFetcher } from "./avatar-fetcher.js";
import {
  type ImportRunnerProgressSnapshot,
  type ImportStartCommonOptions,
  type UpdateJobFn,
  runSpImport,
} from "./import-runner.js";
import { createMobilePersister } from "./mobile-persister.js";
import { createSpTokenStorage } from "./sp-token-storage.js";
import { createTRPCPersisterApi, type TRPCClientSubset } from "./trpc-persister-api.js";

import type { PersisterApi } from "./persister/persister.types.js";
import type { AppRouter, RouterOutput } from "@pluralscape/api-client/trpc";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { AvatarFetcher } from "@pluralscape/import-sp/avatar-fetcher-types";
import type { ImportDataSource } from "@pluralscape/import-sp/source-types";
import type {
  ImportCheckpointState,
  ImportCollectionType,
  ImportJobId,
  SystemId,
} from "@pluralscape/types";
import type { TRPCClient, TRPCUntypedClient } from "@trpc/client";

/** Shape returned by `trpc.importJob.get.useQuery` — includes `checkpointState`. */
type ImportJobRow = RouterOutput["importJob"]["get"];

/**
 * Runtime assertion that the given object satisfies the `TRPCClientSubset`
 * structural shape. The React Query `useUtils().client` returns either a
 * typed proxy (which has all procedure paths as nested objects) or an
 * untyped client (which does not). This guard validates the proxy form.
 */
function assertClientSubset(client: object): asserts client is TRPCClientSubset {
  if (!("system" in client)) {
    throw new Error("Expected a tRPC typed proxy client with procedure paths");
  }
}

/**
 * Build a `PersisterApi` from the `useUtils().client` union. The React
 * Query integration exposes `TRPCClient | TRPCUntypedClient`; we
 * normalize to a typed proxy so the bridge can call `.system.get.query()`
 * etc., then feed that proxy through `createTRPCPersisterApi`.
 */
function buildPersisterApi(
  client: TRPCClient<AppRouter> | TRPCUntypedClient<AppRouter>,
): PersisterApi {
  // If the client is already a typed proxy, assert and use it directly.
  // Otherwise wrap the untyped client into a proxy first.
  const proxy = "system" in client ? client : createTRPCClientProxy<AppRouter>(client);
  assertClientSubset(proxy);
  return createTRPCPersisterApi(proxy);
}

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
  readonly error: Error | null;
  readonly abortControllerRef: React.RefObject<AbortController | null>;
}

// ── Placeholder source used until Phase E wires real source creation ──

/**
 * Build a no-op `ImportSource` of the requested mode. The hook returns
 * this so `runSpImport` has a valid engine collaborator even when the
 * hook tests mock `runSpImport` entirely — exercising the real source
 * factories from the hook happens in Phase E.
 */
function createPlaceholderSource(mode: "api" | "file"): ImportDataSource {
  return {
    mode,
    async *iterate() {
      await Promise.resolve();
    },
    listCollections: () => Promise.resolve([]),
    close: () => Promise.resolve(),
  };
}

// ── Shared updateJobFn factory ───────────────────────────────────────

/**
 * Build the `UpdateJobFn` used by both `useStartImport` and
 * `useResumeActiveImport`. The runner emits readonly arrays inside
 * `checkpointState` and `errorLog`; Zod-inferred mutation inputs are
 * structurally mutable so we shallow-clone the collections that carry
 * readonly arrays before handing them to the mutation.
 */
function buildUpdateJobFn(
  activeSystemId: SystemId,
  // Typed loosely to accommodate the tRPC mutation's branded input type.
  updateJobAsync: (
    input: Record<string, unknown> & { systemId: unknown; importJobId: unknown },
  ) => Promise<unknown>,
): UpdateJobFn {
  return async (importJobId, patch) => {
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
  };
}

// ── Orchestration helper ─────────────────────────────────────────────

interface StartOrchestrationArgs {
  readonly importJobId: ImportJobId;
  readonly systemId: SystemId;
  readonly masterKey: KdfMasterKey;
  readonly api: PersisterApi;
  readonly source: ImportDataSource;
  readonly avatarFetcher: AvatarFetcher;
  readonly options: ImportStartCommonOptions;
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly onProgress?: (snapshot: ImportRunnerProgressSnapshot) => void;
  readonly updateJobFn: UpdateJobFn;
  readonly abortSignal?: AbortSignal;
}

async function startImportRun(args: StartOrchestrationArgs): Promise<void> {
  const persister = createMobilePersister({
    systemId: args.systemId,
    source: "simply-plural",
    masterKey: args.masterKey,
    api: args.api,
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
    ...(args.abortSignal !== undefined ? { abortSignal: args.abortSignal } : {}),
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
  const utils = trpc.useUtils();
  const createJobMutation = trpc.importJob.create.useMutation();
  const updateJobMutation = trpc.importJob.update.useMutation();
  const updateJobAsync = updateJobMutation.mutateAsync;

  const updateJobFn = useMemo(
    () => buildUpdateJobFn(activeSystemId, updateJobAsync),
    [activeSystemId, updateJobAsync],
  );

  const [isStarting, setIsStarting] = useState(false);
  const [runError, setRunError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
          selectedCategories: args.options.selectedCategories as Record<
            ImportCollectionType,
            boolean | undefined
          >,
          avatarMode: args.options.avatarMode,
        });
        if (args.options.persistToken === true) {
          const storage = createSpTokenStorage();
          await storage.set(job.systemId, args.token);
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setRunError(null);
        startImportRun({
          importJobId: job.id,
          systemId: job.systemId,
          masterKey,
          api: buildPersisterApi(utils.client),
          source: createPlaceholderSource("api"),
          avatarFetcher: createMobileAvatarFetcher({
            mode: args.options.avatarMode === "api" ? "api" : "skip",
          }),
          options: args.options,
          updateJobFn,
          abortSignal: controller.signal,
        }).catch((err: unknown) => {
          setRunError(err instanceof Error ? err : new Error(String(err)));
        });
        return job.id;
      } finally {
        setIsStarting(false);
      }
    },
    [activeSystemId, createJobAsync, masterKey, updateJobFn, utils.client],
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
          selectedCategories: args.options.selectedCategories as Record<
            ImportCollectionType,
            boolean | undefined
          >,
          avatarMode: args.options.avatarMode,
        });
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setRunError(null);
        startImportRun({
          importJobId: job.id,
          systemId: job.systemId,
          masterKey,
          api: buildPersisterApi(utils.client),
          source: createPlaceholderSource("file"),
          avatarFetcher: createMobileAvatarFetcher({
            mode: args.options.avatarMode === "api" ? "api" : "skip",
          }),
          options: args.options,
          updateJobFn,
          abortSignal: controller.signal,
        }).catch((err: unknown) => {
          setRunError(err instanceof Error ? err : new Error(String(err)));
        });
        return job.id;
      } finally {
        setIsStarting(false);
      }
    },
    [activeSystemId, createJobAsync, masterKey, updateJobFn, utils.client],
  );

  return {
    startWithToken,
    startWithFile,
    isStarting,
    error: runError,
    abortControllerRef,
  };
}

// ── useImportJob ─────────────────────────────────────────────────────

/**
 * Read a single import job row by id. Returns a disabled query when
 * `jobId` is `null` so callers can gracefully render a pre-start state.
 */
// Re-exported from `./import-progress.hooks.js` so callers that import the
// whole `import.hooks.js` module continue to see the full surface.
export {
  useImportJob,
  useImportProgress,
  useImportSummary,
  type ImportProgressSnapshot,
  type ImportSummary,
} from "./import-progress.hooks.js";

// ── useResumeActiveImport ────────────────────────────────────────────

/** Return type of `useResumeActiveImport`. */
export interface UseResumeActiveImportReturn {
  readonly activeJob: ImportJobRow | null;
  /**
   * Kick off a runner using the active job's checkpoint as the resume
   * point. The caller is responsible for first prompting the user to
   * re-supply the SP token (for API-mode resumes) or re-pick the export
   * file (for file-mode resumes) — this hook only threads an existing
   * checkpoint through to `runSpImport`.
   */
  readonly resume: () => Promise<void>;
  readonly isResuming: boolean;
  readonly error: Error | null;
  readonly abortControllerRef: React.RefObject<AbortController | null>;
}

/**
 * Discover the first in-flight SP import for the active system and
 * expose a `resume()` callback that restarts it from the persisted
 * checkpoint.
 */
export function useResumeActiveImport(): UseResumeActiveImportReturn {
  const activeSystemId = useActiveSystemId();
  const masterKey = useMasterKey();
  const utils = trpc.useUtils();
  const listQuery = trpc.importJob.list.useQuery({
    systemId: activeSystemId,
    status: "importing",
  });
  const updateJobMutation = trpc.importJob.update.useMutation();
  const updateJobAsync = updateJobMutation.mutateAsync;
  const [isResuming, setIsResuming] = useState(false);
  const [runError, setRunError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const firstJob = listQuery.data?.data[0] ?? null;

  const updateJobFn = useMemo(
    () => buildUpdateJobFn(activeSystemId, updateJobAsync),
    [activeSystemId, updateJobAsync],
  );

  const resume = useCallback(async (): Promise<void> => {
    if (firstJob === null) return;
    if (masterKey === null) {
      throw new Error("useResumeActiveImport requires an unlocked crypto provider");
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRunError(null);
    setIsResuming(true);
    try {
      await startImportRun({
        importJobId: firstJob.id,
        systemId: firstJob.systemId,
        masterKey,
        api: buildPersisterApi(utils.client),
        source: createPlaceholderSource("api"),
        avatarFetcher: createMobileAvatarFetcher({ mode: "skip" }),
        options: {
          selectedCategories: firstJob.checkpointState?.options.selectedCategories ?? {},
          avatarMode: firstJob.checkpointState?.options.avatarMode ?? "skip",
        },
        ...(firstJob.checkpointState !== null
          ? { initialCheckpoint: firstJob.checkpointState }
          : {}),
        updateJobFn,
        abortSignal: controller.signal,
      });
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsResuming(false);
    }
  }, [firstJob, masterKey, updateJobFn, utils.client]);

  return {
    activeJob: firstJob,
    resume,
    isResuming,
    error: runError,
    abortControllerRef,
  };
}

// ── useCancelImport ──────────────────────────────────────────────────

/** Return type of `useCancelImport`. */
export interface UseCancelImportReturn {
  readonly cancel: () => Promise<void>;
  readonly isCancelling: boolean;
}

/**
 * Cancel an in-flight SP import by setting the job's status to `failed`
 * and marking the checkpoint as cancelled. The checkpoint is preserved
 * so a subsequent resume would still be theoretically possible, though
 * the wizard typically hides the resume path once the user cancels.
 *
 * Pass `abortController` to also signal the in-flight runner to stop
 * before updating the job status.
 */
export function useCancelImport(
  jobId: ImportJobId,
  abortController?: AbortController | null,
): UseCancelImportReturn {
  const activeSystemId = useActiveSystemId();
  const updateMutation = trpc.importJob.update.useMutation();
  const getQuery = trpc.importJob.get.useQuery({ systemId: activeSystemId, importJobId: jobId });

  const [isCancelling, setIsCancelling] = useState(false);
  const updateAsync = updateMutation.mutateAsync;
  const currentJob = getQuery.data;

  const updateJobFn = useMemo(
    () => buildUpdateJobFn(activeSystemId, updateAsync),
    [activeSystemId, updateAsync],
  );

  const cancel = useCallback(async (): Promise<void> => {
    setIsCancelling(true);
    try {
      abortController?.abort();
      const checkpoint = currentJob?.checkpointState ?? undefined;
      await updateJobFn(jobId, {
        status: "failed",
        ...(checkpoint !== undefined ? { checkpointState: checkpoint } : {}),
      });
    } finally {
      setIsCancelling(false);
    }
  }, [abortController, currentJob, jobId, updateJobFn]);

  return { cancel, isCancelling };
}
