import { z } from "zod";

import { HTTP_NOT_FOUND } from "../http.constants.js";

export const COMMIT_HEADLINE = "chore(i18n): daily Crowdin translation sync";

const GITHUB_API = "https://api.github.com";
/** Length of the two status columns and the separating space in `git status --porcelain`. */
const PORCELAIN_PATH_OFFSET = 3;

const CREATE_COMMIT_MUTATION = `mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}`;

const commitResponseSchema = z.object({
  data: z
    .object({ createCommitOnBranch: z.object({ commit: z.object({ oid: z.string() }) }) })
    .nullish(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export interface TranslationChanges {
  readonly additions: readonly string[];
  readonly deletions: readonly string[];
}

export interface CommitTranslationsOptions {
  readonly repository: string;
  readonly branch: string;
  readonly baseSha: string;
  readonly token: string;
  readonly fetch: typeof fetch;
  readonly readFile: (path: string) => Buffer;
}

export function parseChangedFiles(porcelain: string): TranslationChanges {
  const additions: string[] = [];
  const deletions: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line === "") continue;
    const status = line.slice(0, PORCELAIN_PATH_OFFSET);
    const path = line.slice(PORCELAIN_PATH_OFFSET);
    (status.includes("D") ? deletions : additions).push(path);
  }
  return { additions, deletions };
}

async function assertOk(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    throw new Error(`${action} failed with ${String(response.status)}: ${await response.text()}`);
  }
}

/** Points the branch at the base commit, creating it if needed, so the PR holds one commit. */
async function resetBranch(
  options: CommitTranslationsOptions,
  headers: Readonly<Record<string, string>>,
): Promise<void> {
  const { repository, branch, baseSha } = options;
  const refsUrl = `${GITHUB_API}/repos/${repository}/git/refs`;
  const refUrl = `${refsUrl}/heads/${branch}`;

  const existing = await options.fetch(refUrl, { headers });
  const response =
    existing.status === HTTP_NOT_FOUND
      ? await options.fetch(refsUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        })
      : await options.fetch(refUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ sha: baseSha, force: true }),
        });
  await assertOk(response, `Resetting ${branch}`);
}

/**
 * Commits the files through GitHub's API, which signs the commit. An App has no
 * key of its own, and unsigned head commits can block a squash merge on main.
 *
 * @returns the new commit's SHA, or null when there is nothing to commit.
 */
export async function commitTranslations(
  changes: TranslationChanges,
  options: CommitTranslationsOptions,
): Promise<string | null> {
  if (changes.additions.length === 0 && changes.deletions.length === 0) return null;

  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  await resetBranch(options, headers);

  const response = await options.fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: CREATE_COMMIT_MUTATION,
      variables: {
        input: {
          branch: { repositoryNameWithOwner: options.repository, branchName: options.branch },
          message: { headline: COMMIT_HEADLINE },
          expectedHeadOid: options.baseSha,
          fileChanges: {
            additions: changes.additions.map((path) => ({
              path,
              contents: options.readFile(path).toString("base64"),
            })),
            deletions: changes.deletions.map((path) => ({ path })),
          },
        },
      },
    }),
  });
  await assertOk(response, "Creating the commit");

  const body = commitResponseSchema.parse(await response.json());
  if (body.errors !== undefined && body.errors.length > 0) {
    throw new Error(`Creating the commit failed: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) throw new Error("Creating the commit returned no data");
  return body.data.createCommitOnBranch.commit.oid;
}
