import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { evaluatePr } from "./crowdin/automerge/evaluate.js";
import { commentPr, fetchPrContext, mergePr } from "./crowdin/automerge/gh.js";

function writeOutput(key: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

function writeSummary(content: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${content}\n`);
  console.log(content);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      pr: { type: "string" },
      owner: { type: "string" },
      repo: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const prNumber = Number(values.pr);
  const owner = values.owner;
  const repo = values.repo;
  if (!prNumber || !owner || !repo) {
    console.error(
      "Usage: crowdin-automerge-guard --pr <num> --owner <owner> --repo <repo> [--dry-run]",
    );
    process.exit(2);
  }

  const context = await fetchPrContext(prNumber, owner, repo);
  const result = evaluatePr(context);

  writeOutput("eligible", String(result.eligible));
  if (result.skipReason) writeOutput("skip_reason", result.skipReason);
  if (result.summary) writeOutput("summary", result.summary);

  if (!result.eligible) {
    writeSummary(
      `## crowdin-automerge: skipped PR #${prNumber}\n\nReason: \`${result.skipReason}\``,
    );
    if (!values["dry-run"] && result.skipReason) {
      await commentPr(
        prNumber,
        `Auto-merge skipped: \`${result.skipReason}\`. See workflow logs for details.`,
        owner,
        repo,
      );
    }
    return;
  }

  const subject = "chore(i18n): sync translations from Crowdin";
  const body = result.summary ?? "";
  writeSummary(`## crowdin-automerge: merging PR #${prNumber}\n\n${body}`);
  if (!values["dry-run"]) await mergePr(prNumber, subject, body);
}

main().catch((err: unknown) => {
  console.error("crowdin:automerge-guard failed:", err);
  process.exit(1);
});
