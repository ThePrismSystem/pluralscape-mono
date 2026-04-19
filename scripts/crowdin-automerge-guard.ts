import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  ACTIONABLE_SKIP_REASONS,
  evaluatePr,
  type EvaluationResult,
  type PrContext,
} from "./crowdin/automerge/evaluate.js";
import { commentPr, fetchPrContext, mergePr } from "./crowdin/automerge/gh.js";
import { getErrorMessage } from "./crowdin/errors.js";

export interface GuardDeps {
  fetchPrContext: typeof fetchPrContext;
  mergePr: typeof mergePr;
  commentPr: typeof commentPr;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
  appendTo?: (path: string, content: string) => void;
}

function appendAndLog(
  path: string,
  content: string,
  log: (msg: string) => void,
  appendTo: GuardDeps["appendTo"],
): void {
  const append =
    appendTo ??
    ((p: string, c: string): void => {
      appendFileSync(p, c);
    });
  append(path, `${content}\n`);
  log(content);
}

function buildCommentBody(
  pr: PrContext,
  result: Extract<EvaluationResult, { eligible: false }>,
): string {
  return `Crowdin auto-merge skipped: \`${result.skipReason}\`. See the ops runbook for interpretation. (PR #${String(pr.number)})`;
}

/**
 * Parses CROWDIN_AUTOMERGE_DRY_RUN. Defaults to dry-run when unset. Accepts
 * only the exact tokens "true" and "false" (trimmed) — any other value throws
 * so a typoed repo variable fails loud instead of silently going live.
 */
function parseDryRun(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  throw new Error(
    `CROWDIN_AUTOMERGE_DRY_RUN must be exactly "true" or "false" (got ${JSON.stringify(raw)}).`,
  );
}

function resolveSummaryAndOutputPaths(env: Record<string, string | undefined>): {
  summary: string;
  output: string;
} {
  const summary = env.GITHUB_STEP_SUMMARY;
  const output = env.GITHUB_OUTPUT;
  const inCi = env.CI === "true" || env.GITHUB_ACTIONS === "true";
  if (inCi) {
    if (!summary) throw new Error("GITHUB_STEP_SUMMARY must be set in CI");
    if (!output) throw new Error("GITHUB_OUTPUT must be set in CI");
    return { summary, output };
  }
  if (!summary || !output) {
    // Local-run fallback: log once so the operator knows they're not
    // capturing the summary/output channels.
    console.warn(
      "[crowdin-automerge-guard] GITHUB_STEP_SUMMARY/GITHUB_OUTPUT not set; falling back to /dev/null.",
    );
  }
  return { summary: summary ?? "/dev/null", output: output ?? "/dev/null" };
}

export async function runGuard(
  prNumber: number,
  owner: string,
  repo: string,
  deps: GuardDeps,
): Promise<void> {
  const dryRun = parseDryRun(deps.env.CROWDIN_AUTOMERGE_DRY_RUN);
  const { summary: summaryPath, output: outputPath } = resolveSummaryAndOutputPaths(deps.env);
  deps.log(`dryRun=${String(dryRun)}`);
  appendAndLog(summaryPath, `dryRun=${String(dryRun)}`, deps.log, deps.appendTo);

  const pr = await deps.fetchPrContext(owner, repo, prNumber);
  const result = evaluatePr(pr);

  if (result.eligible) {
    appendAndLog(summaryPath, `auto-merge: eligible (${result.summary})`, deps.log, deps.appendTo);
    appendAndLog(outputPath, `eligible=true`, deps.log, deps.appendTo);
    if (!dryRun) {
      await deps.mergePr(prNumber, result.head.sha);
    }
    return;
  }

  const isActionable = ACTIONABLE_SKIP_REASONS.has(result.skipReason);
  appendAndLog(summaryPath, `auto-merge: skipped (${result.skipReason})`, deps.log, deps.appendTo);
  appendAndLog(outputPath, `eligible=false`, deps.log, deps.appendTo);

  if (isActionable && !dryRun) {
    try {
      await deps.commentPr(prNumber, buildCommentBody(pr, result));
    } catch (err) {
      const message = getErrorMessage(err);
      deps.log(`comment failed (non-fatal): ${message}`);
      appendAndLog(outputPath, `comment_failed=true`, deps.log, deps.appendTo);
      appendAndLog(
        summaryPath,
        `warning: PR comment failed (non-fatal): ${message}`,
        deps.log,
        deps.appendTo,
      );
    }
  }
}

function parseRepository(raw: string | undefined): { owner: string; repo: string } {
  if (!raw || !raw.includes("/")) {
    throw new Error(`GITHUB_REPOSITORY must be set to "owner/repo" (got ${JSON.stringify(raw)}).`);
  }
  const [owner, repo, ...rest] = raw.split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`GITHUB_REPOSITORY must be exactly "owner/repo" (got ${JSON.stringify(raw)}).`);
  }
  return { owner, repo };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { pr: { type: "string" } },
  });
  const prNumber = Number(values.pr);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error("crowdin-automerge-guard: --pr must be a positive integer");
    process.exit(1);
  }
  const { owner, repo } = parseRepository(process.env.GITHUB_REPOSITORY);

  await runGuard(prNumber, owner, repo, {
    fetchPrContext,
    mergePr,
    commentPr,
    log: (msg: string): void => {
      console.log(msg);
    },
    env: process.env,
  });
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  main().catch((err: unknown) => {
    console.error("crowdin-automerge-guard failed:", err);
    process.exit(1);
  });
}
