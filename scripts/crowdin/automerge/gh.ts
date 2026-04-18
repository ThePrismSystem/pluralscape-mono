import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PrCheck, PrContext, PrFile, PrReview } from "./evaluate.js";

const exec = promisify(execFile);

async function gh(args: string[]): Promise<string> {
  const { stdout } = await exec("gh", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

interface PrApiResponse {
  number: number;
  user: { login: string };
  head: { ref: string };
  base: { ref: string };
  labels: { name: string }[];
}

interface PrFileApiEntry {
  filename: string;
  status: PrFile["status"];
}

interface PrReviewApiEntry {
  state: PrReview["state"];
}

interface PrCheckApiEntry {
  name: string;
  conclusion: PrCheck["conclusion"];
}

export async function fetchPrContext(
  prNumber: number,
  owner: string,
  repo: string,
): Promise<PrContext> {
  const prRaw = await gh(["api", `repos/${owner}/${repo}/pulls/${prNumber}`]);
  const pr = JSON.parse(prRaw) as PrApiResponse;

  const filesRaw = await gh([
    "api",
    "--paginate",
    `repos/${owner}/${repo}/pulls/${prNumber}/files`,
  ]);
  const files = (JSON.parse(filesRaw) as PrFileApiEntry[]).map((f) => ({
    path: f.filename,
    status: f.status,
  }));

  const reviewsRaw = await gh([
    "api",
    "--paginate",
    `repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
  ]);
  const reviews = (JSON.parse(reviewsRaw) as PrReviewApiEntry[]).map((r) => ({
    state: r.state,
  }));

  const checksRaw = await gh([
    "api",
    "--paginate",
    `repos/${owner}/${repo}/commits/${pr.head.ref}/check-runs`,
    "--jq",
    ".check_runs[] | {name: .name, conclusion: .conclusion}",
  ]);
  const checks: PrCheck[] = checksRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PrCheckApiEntry)
    .map((c) => ({ name: c.name, conclusion: c.conclusion }));

  return {
    number: pr.number,
    author: pr.user.login,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    labels: pr.labels.map((l) => l.name),
    files,
    reviews,
    checks,
  };
}

export async function mergePr(prNumber: number, subject: string, body: string): Promise<void> {
  await gh([
    "pr",
    "merge",
    String(prNumber),
    "--squash",
    "--delete-branch",
    "--subject",
    subject,
    "--body",
    body,
  ]);
}

export async function commentPr(
  prNumber: number,
  body: string,
  owner: string,
  repo: string,
): Promise<void> {
  await gh([
    "api",
    "--method",
    "POST",
    `repos/${owner}/${repo}/issues/${prNumber}/comments`,
    "-f",
    `body=${body}`,
  ]);
}
