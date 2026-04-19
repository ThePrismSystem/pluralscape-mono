import { setTimeout as sleep } from "node:timers/promises";

import { TARGET_LANGUAGE_IDS, type TargetLanguageId } from "./languages.js";
import { ENGINE_ROUTING, type Engine } from "./mt.js";
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  type PretranslateMethod,
} from "./pretranslate.constants.js";

export interface PretranslateOptions {
  deeplMtId: number;
  googleMtId: number;
  fileIds?: number[];
  languageIds?: readonly TargetLanguageId[];
}

export interface PretranslatePass {
  method: PretranslateMethod;
  engineId?: number;
  languageIds: readonly string[];
  label: string;
}

export type PretranslatePassStatus = "finished" | "failed" | "skipped_due_to_prior_failure";

export interface PretranslateFailureContext {
  /** Last-observed status string returned by Crowdin's preTranslationStatus. */
  status: string;
  progress?: number;
  labelIds?: readonly number[];
  languageIds?: readonly string[];
}

/**
 * Minimal structural surface of the Crowdin SDK required by this module.
 *
 * Declared locally (instead of importing `CrowdinClient`) so unit tests can
 * substitute a mock without an unsafe `as unknown as CrowdinClient` cast. The
 * real `CrowdinClient` instance is structurally assignable to this type.
 */
export interface PretranslateClient {
  readonly translationsApi: {
    applyPreTranslation: (
      projectId: number,
      request: {
        method: PretranslateMethod;
        engineId?: number;
        autoApproveOption: "all";
        duplicateTranslations: boolean;
        translateUntranslatedOnly: boolean;
        translateWithPerfectMatchOnly: boolean;
        fileIds: number[];
        languageIds: string[];
        labelIds: number[];
      },
    ) => Promise<{ data: { identifier: string } }>;
    preTranslationStatus: (
      projectId: number,
      identifier: string,
    ) => Promise<{ data: PreTranslationStatusResponse }>;
  };
}

interface PreTranslationStatusResponse {
  status: string;
  progress?: number;
  attributes?: {
    labelIds?: number[];
    languageIds?: string[];
  };
}

export function planPretranslatePasses(opts: PretranslateOptions): PretranslatePass[] {
  const targets = opts.languageIds ?? TARGET_LANGUAGE_IDS;
  const byEngine: Record<Engine, string[]> = { deepl: [], google: [] };
  for (const id of targets) {
    byEngine[ENGINE_ROUTING[id as TargetLanguageId]].push(id);
  }

  const passes: PretranslatePass[] = [{ method: "tm", languageIds: targets, label: "TM" }];
  if (byEngine.deepl.length > 0) {
    passes.push({
      method: "mt",
      engineId: opts.deeplMtId,
      languageIds: byEngine.deepl,
      label: "MT (DeepL)",
    });
  }
  if (byEngine.google.length > 0) {
    passes.push({
      method: "mt",
      engineId: opts.googleMtId,
      languageIds: byEngine.google,
      label: "MT (Google)",
    });
  }
  return passes;
}

export interface PretranslateResult {
  passes: Array<{
    label: string;
    identifier: string;
    status: PretranslatePassStatus;
    failureContext?: PretranslateFailureContext;
  }>;
}

async function runSinglePass(
  client: PretranslateClient,
  projectId: number,
  pass: PretranslatePass,
  opts: PretranslateOptions,
  signal: AbortSignal,
): Promise<{
  identifier: string;
  status: "finished" | "failed";
  failureContext?: PretranslateFailureContext;
}> {
  const job = await client.translationsApi.applyPreTranslation(projectId, {
    method: pass.method,
    engineId: pass.engineId,
    autoApproveOption: "all",
    duplicateTranslations: false,
    translateUntranslatedOnly: true,
    translateWithPerfectMatchOnly: false,
    fileIds: opts.fileIds ?? [],
    languageIds: [...pass.languageIds],
    labelIds: [],
  });
  return pollJob(client, projectId, job.data.identifier, pass.label, signal);
}

async function pollJob(
  client: PretranslateClient,
  projectId: number,
  id: string,
  label: string,
  signal: AbortSignal,
): Promise<{
  identifier: string;
  status: "finished" | "failed";
  failureContext?: PretranslateFailureContext;
}> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    if (signal.aborted) throw new Error(`${label} pretranslate ${id} aborted`);
    const r = await client.translationsApi.preTranslationStatus(projectId, id);
    if (r.data.status === "finished") {
      return { identifier: id, status: "finished" };
    }
    if (r.data.status === "failed") {
      return {
        identifier: id,
        status: "failed",
        failureContext: {
          status: r.data.status,
          progress: r.data.progress,
          labelIds: r.data.attributes?.labelIds,
          languageIds: r.data.attributes?.languageIds,
        },
      };
    }
    try {
      await sleep(POLL_INTERVAL_MS, undefined, { signal });
    } catch (err) {
      if (signal.aborted) throw new Error(`${label} pretranslate ${id} aborted`);
      throw err;
    }
  }
  throw new Error(`${label} pretranslate ${id} timed out after ${POLL_TIMEOUT_MS}ms`);
}

export async function runPretranslate(
  client: PretranslateClient,
  projectId: number,
  opts: PretranslateOptions,
  signal: AbortSignal = new AbortController().signal,
): Promise<PretranslateResult> {
  const passes = planPretranslatePasses(opts);
  const results: PretranslateResult["passes"] = [];
  let priorFailure = false;
  for (const pass of passes) {
    if (priorFailure) {
      results.push({
        label: pass.label,
        identifier: "",
        status: "skipped_due_to_prior_failure",
      });
      continue;
    }
    const r = await runSinglePass(client, projectId, pass, opts, signal);
    results.push({
      label: pass.label,
      identifier: r.identifier,
      status: r.status,
      failureContext: r.failureContext,
    });
    if (r.status === "failed") priorFailure = true;
  }
  return { passes: results };
}
