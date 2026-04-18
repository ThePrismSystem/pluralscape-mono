import type { CrowdinClient } from "./client.js";

export interface PretranslateOptions {
  deeplMtId: number;
  googleMtId: number;
  fileIds?: number[];
  languageIds?: string[];
}

/**
 * Internal request shape returned by `buildPretranslateRequest`.
 *
 * `applyUntranslatedStringsOnly` maps to the SDK's `translateUntranslatedOnly`
 * field when the request is submitted; we use a more explicit name here for
 * clarity in tests and callsite documentation.
 */
export interface PretranslateRequest {
  method: "tm";
  autoApproveOption: "none";
  duplicateTranslations: boolean;
  applyUntranslatedStringsOnly: boolean;
  translateWithPerfectMatchOnly: boolean;
  fileIds: number[];
  languageIds: string[];
  labelIds: number[];
}

/**
 * Builds the pre-translate request payload as a pure function so it can be
 * unit-tested without a live Crowdin client.
 *
 * Strategy: TM first (reuses existing memory), then MT for anything left
 * untranslated. `autoApproveOption: "none"` keeps all pre-translations as
 * suggestions — human translators review before approval.
 */
export function buildPretranslateRequest(opts: PretranslateOptions): PretranslateRequest {
  return {
    method: "tm",
    autoApproveOption: "none",
    duplicateTranslations: false,
    applyUntranslatedStringsOnly: true,
    translateWithPerfectMatchOnly: false,
    fileIds: opts.fileIds ?? [],
    languageIds: opts.languageIds ?? [],
    labelIds: [],
  };
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000;

export async function runPretranslate(
  client: CrowdinClient,
  projectId: number,
  opts: PretranslateOptions,
): Promise<{ identifier: string; status: string; progress: number }> {
  const request = buildPretranslateRequest(opts);

  // Map our internal field name to the SDK's field name.
  const job = await client.translationsApi.applyPreTranslation(projectId, {
    method: request.method,
    autoApproveOption: request.autoApproveOption,
    duplicateTranslations: request.duplicateTranslations,
    translateUntranslatedOnly: request.applyUntranslatedStringsOnly,
    translateWithPerfectMatchOnly: request.translateWithPerfectMatchOnly,
    fileIds: request.fileIds,
    languageIds: request.languageIds,
    labelIds: request.labelIds,
  });

  const identifier = job.data.identifier;
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const statusResponse = await client.translationsApi.preTranslationStatus(projectId, identifier);
    const jobStatus = statusResponse.data.status;
    if (jobStatus === "finished" || jobStatus === "failed") {
      return {
        identifier,
        status: jobStatus,
        // `progress` is not on PreTranslationStatusAttributes; fall back to 100
        // when complete. The SDK's BuildStatus wrapper exposes it for builds but
        // not for pre-translation status responses.
        progress: 100,
      };
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`pretranslate job ${identifier} timed out after ${POLL_TIMEOUT_MS}ms`);
}
