import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  ACTIONABLE_SKIP_REASONS,
  evaluatePr,
  type EvaluationResult,
  type PrContext,
} from "./crowdin/automerge/evaluate.js";
import { commentPr, fetchPrContext, mergePr } from "./crowdin/automerge/gh.js";

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

export async function runGuard(
  prNumber: number,
  owner: string,
  repo: string,
  deps: GuardDeps,
): Promise<void> {
  const pr = await deps.fetchPrContext(owner, repo, prNumber);
  const result = evaluatePr(pr);
  const dryRun = (deps.env.CROWDIN_AUTOMERGE_DRY_RUN ?? "true") !== "false";
  const summaryPath = deps.env.GITHUB_STEP_SUMMARY ?? "/dev/null";
  const outputPath = deps.env.GITHUB_OUTPUT ?? "/dev/null";

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
      const message = err instanceof Error ? err.message : String(err);
      deps.log(`comment failed (non-fatal): ${message}`);
    }
  }
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
  const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "pluralscape";
  const repoFull = process.env.GITHUB_REPOSITORY ?? "pluralscape/pluralscape-mono";
  const repo = repoFull.split("/")[1] ?? "pluralscape-mono";

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
