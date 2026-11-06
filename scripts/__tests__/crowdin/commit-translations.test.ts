import { describe, expect, it, vi } from "vitest";

import {
  COMMIT_HEADLINE,
  commitTranslations,
  parseChangedFiles,
} from "../../crowdin/commit-translations.js";
import { HTTP_NOT_FOUND } from "../../http.constants.js";

const REPOSITORY = "owner/repo";
const BRANCH = "chore/crowdin-translations";
const BASE_SHA = "a".repeat(40);
const COMMIT_SHA = "b".repeat(40);
const GRAPHQL_URL = "https://api.github.com/graphql";
const REF_URL = `https://api.github.com/repos/${REPOSITORY}/git/refs/heads/${BRANCH}`;
const REFS_URL = `https://api.github.com/repos/${REPOSITORY}/git/refs`;

function urlOf(input: Parameters<typeof fetch>[0] | undefined): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : (input?.url ?? "");
}

function bodyOf(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("expected a JSON request body");
  return JSON.parse(init.body);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

interface StubOptions {
  readonly branchExists?: boolean;
  readonly commitResponse?: Response;
  readonly refUpdateResponse?: Response;
}

function stubFetch(options: StubOptions = {}) {
  const { branchExists = true } = options;
  return vi.fn<typeof fetch>((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (url === GRAPHQL_URL) {
      return Promise.resolve(
        options.commitResponse ??
          json({ data: { createCommitOnBranch: { commit: { oid: COMMIT_SHA } } } }),
      );
    }
    if (method === "GET") {
      return Promise.resolve(branchExists ? json({}) : json({}, HTTP_NOT_FOUND));
    }
    return Promise.resolve(options.refUpdateResponse ?? json({}));
  });
}

function run(
  fetchImpl: typeof fetch,
  changes = { additions: ["apps/mobile/locales/fr/common.json"], deletions: [] as string[] },
) {
  return commitTranslations(changes, {
    repository: REPOSITORY,
    branch: BRANCH,
    baseSha: BASE_SHA,
    token: "token",
    fetch: fetchImpl,
    readFile: (path) => Buffer.from(`contents of ${path}`),
  });
}

function graphqlInput(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => urlOf(url) === GRAPHQL_URL);
  const body = bodyOf(call?.[1]) as { variables: { input: Record<string, unknown> } };
  return body.variables.input;
}

describe("parseChangedFiles", () => {
  it("returns nothing for clean output", () => {
    expect(parseChangedFiles("")).toEqual({ additions: [], deletions: [] });
  });

  it("treats new and modified files as additions", () => {
    const output = " M apps/mobile/locales/fr/common.json\n?? apps/mobile/locales/fr/auth.json\n";
    expect(parseChangedFiles(output)).toEqual({
      additions: ["apps/mobile/locales/fr/common.json", "apps/mobile/locales/fr/auth.json"],
      deletions: [],
    });
  });

  it("treats removed files as deletions", () => {
    expect(parseChangedFiles(" D apps/mobile/locales/fr/old.json\n")).toEqual({
      additions: [],
      deletions: ["apps/mobile/locales/fr/old.json"],
    });
  });
});

describe("commitTranslations", () => {
  it("makes no API calls when nothing changed", async () => {
    const fetchMock = stubFetch();
    await expect(run(fetchMock, { additions: [], deletions: [] })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resets an existing branch to the base commit before committing", async () => {
    const fetchMock = stubFetch();
    await expect(run(fetchMock)).resolves.toBe(COMMIT_SHA);

    const update = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(urlOf(update?.[0])).toBe(REF_URL);
    expect(bodyOf(update?.[1])).toEqual({ sha: BASE_SHA, force: true });
  });

  it("creates the branch from the base commit when it doesn't exist", async () => {
    const fetchMock = stubFetch({ branchExists: false });
    await expect(run(fetchMock)).resolves.toBe(COMMIT_SHA);

    const create = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(urlOf(create?.[0])).toBe(REFS_URL);
    expect(bodyOf(create?.[1])).toEqual({
      ref: `refs/heads/${BRANCH}`,
      sha: BASE_SHA,
    });
  });

  it("sends every file in one commit based on the base commit", async () => {
    const fetchMock = stubFetch();
    await run(fetchMock, {
      additions: ["apps/mobile/locales/fr/common.json"],
      deletions: ["apps/mobile/locales/fr/old.json"],
    });

    expect(graphqlInput(fetchMock)).toEqual({
      branch: { repositoryNameWithOwner: REPOSITORY, branchName: BRANCH },
      message: { headline: COMMIT_HEADLINE },
      expectedHeadOid: BASE_SHA,
      fileChanges: {
        additions: [
          {
            path: "apps/mobile/locales/fr/common.json",
            contents: Buffer.from("contents of apps/mobile/locales/fr/common.json").toString(
              "base64",
            ),
          },
        ],
        deletions: [{ path: "apps/mobile/locales/fr/old.json" }],
      },
    });
  });

  it("rejects when resetting the branch fails", async () => {
    const fetchMock = stubFetch({ refUpdateResponse: json({ message: "denied" }, 403) });
    await expect(run(fetchMock)).rejects.toThrow(/403/);
    expect(fetchMock.mock.calls.some(([url]) => urlOf(url) === GRAPHQL_URL)).toBe(false);
  });

  it("rejects when the commit request fails", async () => {
    const fetchMock = stubFetch({ commitResponse: json({ message: "bad" }, 500) });
    await expect(run(fetchMock)).rejects.toThrow(/500/);
  });

  it("rejects when GraphQL reports errors with a 200 response", async () => {
    const fetchMock = stubFetch({
      commitResponse: json({ errors: [{ message: "expected head moved" }] }),
    });
    await expect(run(fetchMock)).rejects.toThrow(/expected head moved/);
  });
});
