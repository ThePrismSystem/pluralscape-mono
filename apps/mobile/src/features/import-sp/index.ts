/**
 * Public API for the mobile-side Simply Plural import feature.
 *
 * Consumers (the future wizard UI, test harnesses, and the E2E layer)
 * should import exclusively from this barrel. Internal modules —
 * persister helpers, dispatch tables, private constants — are not
 * re-exported and must not be imported directly from outside the
 * feature directory.
 */

// ── Avatar + token helpers ───────────────────────────────────────────
export { createMobileAvatarFetcher } from "./avatar-fetcher.js";
export type { MobileAvatarFetcherArgs } from "./avatar-fetcher.js";
export { createSpTokenStorage } from "./sp-token-storage.js";
export type { SpTokenStorage } from "./sp-token-storage.js";

// ── Persister construction ───────────────────────────────────────────
export { createMobilePersister } from "./mobile-persister.js";
export type {
  CreateMobilePersisterArgs,
  MobilePersister,
  PreloadHint,
} from "./mobile-persister.js";

// ── Runner ────────────────────────────────────────────────────────────
export { runSpImport } from "./import-runner.js";
export type {
  ImportJobUpdatePatch,
  ImportRunnerProgressSnapshot,
  ImportStartCommonOptions,
  RunSpImportArgs,
  UpdateJobFn,
} from "./import-runner.js";

// ── React hooks ──────────────────────────────────────────────────────
export {
  useCancelImport,
  useImportJob,
  useImportProgress,
  useImportSummary,
  useResumeActiveImport,
  useStartImport,
} from "./import.hooks.js";
export type {
  DocumentPickerAsset,
  ImportProgressSnapshot,
  ImportSummary,
  StartWithFileArgs,
  StartWithTokenArgs,
  UseCancelImportReturn,
  UseResumeActiveImportReturn,
  UseStartImportReturn,
} from "./import.hooks.js";
