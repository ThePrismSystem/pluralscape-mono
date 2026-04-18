import { execFile } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import type { PrContext } from "./evaluate.js";

const execFileAsync = promisify(execFile);

async function execGh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args);
  return stdout;
}

const PrApiSchema = z.object({
  number: z.number(),
  user: z.object({ login: z.string() }),
  head: z.object({ sha: z.string(), ref: z.string() }),
  base: z.object({ ref: z.string() }),
  labels: z.array(z.object({ name: z.string() })),
});

const FilesSchema = z.array(
  z.object({
    filename: z.string(),
    status: z.enum(["added", "modified", "removed", "renamed", "copied"]),
  }),
);

const ReviewsSchema = z.array(
  z.object({
    state: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"]),
  }),
);

const ChecksSchema = z.object({
  check_runs: z.array(
    z.object({
      name: z.string(),
      conclusion: z
        .enum([
          "success",
          "failure",
          "cancelled",
          "timed_out",
          "skipped",
          "neutral",
          "action_required",
        ])
        .nullable(),
    }),
  ),
});

export async function fetchPrContext(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PrContext> {
  const prRaw = await execGh(["api", `repos/${owner}/${repo}/pulls/${String(prNumber)}`]);
  const pr = PrApiSchema.parse(JSON.parse(prRaw));

  const checksRaw = await execGh([
    "api",
    `repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`,
    "--paginate",
  ]);
  const checks = ChecksSchema.parse(JSON.parse(checksRaw)).check_runs;

  const filesRaw = await execGh([
    "api",
    `repos/${owner}/${repo}/pulls/${String(prNumber)}/files`,
    "--paginate",
  ]);
  const files = FilesSchema.parse(JSON.parse(filesRaw));

  const reviewsRaw = await execGh([
    "api",
    `repos/${owner}/${repo}/pulls/${String(prNumber)}/reviews`,
    "--paginate",
  ]);
  const reviews = ReviewsSchema.parse(JSON.parse(reviewsRaw));

  return {
    number: pr.number,
    author: pr.user.login,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    baseRef: pr.base.ref,
    labels: pr.labels.map((l) => l.name),
    files: files.map((f) => ({ path: f.filename, status: f.status })),
    reviews: reviews.map((r) => ({ state: r.state })),
    checks,
  };
}

export async function mergePr(prNumber: number, headSha: string): Promise<void> {
  await execGh([
    "pr",
    "merge",
    String(prNumber),
    "--squash",
    "--auto",
    "--match-head-commit",
    headSha,
  ]);
}

export async function commentPr(prNumber: number, body: string): Promise<void> {
  const tmp = join(
    tmpdir(),
    `crowdin-automerge-comment-${String(prNumber)}-${String(Date.now())}.txt`,
  );
  writeFileSync(tmp, body);
  try {
    await execGh(["pr", "comment", String(prNumber), "--body-file", tmp]);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // tmp file already gone — harmless
    }
  }
}
