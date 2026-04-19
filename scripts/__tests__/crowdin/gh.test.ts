import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:child_process.execFile before gh.js imports it.
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (
    cmd: string,
    args: string[],
    cb: (err: Error | null, result: { stdout: string; stderr: string }) => void,
  ): void => {
    mockExecFile(cmd, args)
      .then((result: { stdout: string; stderr: string }) => {
        cb(null, result);
      })
      .catch((err: Error) => {
        cb(err, { stdout: "", stderr: "" });
      });
  },
}));

// Import AFTER mock setup.
const { commentPr, fetchPrContext, mergePr } = await import("../../crowdin/automerge/gh.js");

afterEach(() => {
  mockExecFile.mockReset();
});

function mockResponses(responses: Record<string, string>): void {
  // Match most-specific key first so "pulls/1/files" doesn't shadow to
  // the "pulls/1" PR response.
  const sortedKeys = Object.keys(responses).sort((a, b) => b.length - a.length);
  mockExecFile.mockImplementation(async (_cmd: string, args: string[]) => {
    const apiPath = args[1] ?? "";
    for (const key of sortedKeys) {
      if (apiPath.includes(key)) {
        return { stdout: responses[key] ?? "", stderr: "" };
      }
    }
    throw new Error(`unmocked gh call: ${args.join(" ")}`);
  });
}

describe("fetchPrContext", () => {
  it("returns headSha from the parsed PR response", async () => {
    mockResponses({
      "pulls/1": JSON.stringify({
        number: 1,
        user: { login: "github-actions[bot]" },
        head: { sha: "cafef00d", ref: "chore/crowdin-translations" },
        base: { ref: "main" },
        labels: [],
      }),
      "commits/cafef00d/check-runs": JSON.stringify({
        check_runs: [{ name: "ci", conclusion: "success" }],
      }),
      "pulls/1/files": JSON.stringify([
        { filename: "apps/mobile/locales/fr/common.json", status: "modified" },
      ]),
      "pulls/1/reviews": JSON.stringify([]),
    });
    const ctx = await fetchPrContext("org", "repo", 1);
    expect(ctx.headSha).toBe("cafef00d");
    expect(ctx.checks).toEqual([{ name: "ci", conclusion: "success" }]);
    expect(ctx.files).toEqual([
      {
        path: "apps/mobile/locales/fr/common.json",
        status: "modified",
        previousFilename: undefined,
      },
    ]);
  });

  it("captures previous_filename for renamed files", async () => {
    mockResponses({
      "pulls/10": JSON.stringify({
        number: 10,
        user: { login: "github-actions[bot]" },
        head: { sha: "abc", ref: "chore/crowdin-translations" },
        base: { ref: "main" },
        labels: [],
      }),
      "commits/abc/check-runs": JSON.stringify({ check_runs: [] }),
      "pulls/10/files": JSON.stringify([
        {
          filename: "apps/mobile/locales/fr/new.json",
          status: "renamed",
          previous_filename: "apps/mobile/locales/fr/old.json",
        },
      ]),
      "pulls/10/reviews": JSON.stringify([]),
    });
    const ctx = await fetchPrContext("org", "repo", 10);
    expect(ctx.files[0]?.previousFilename).toBe("apps/mobile/locales/fr/old.json");
  });

  it("throws when PR JSON is missing head.sha (zod validation)", async () => {
    mockResponses({
      "pulls/2": JSON.stringify({
        number: 2,
        user: { login: "x" },
        head: { ref: "x" }, // no sha
        base: { ref: "main" },
        labels: [],
      }),
    });
    await expect(fetchPrContext("org", "repo", 2)).rejects.toThrow();
  });

  it("handles empty check-runs array cleanly", async () => {
    mockResponses({
      "pulls/3": JSON.stringify({
        number: 3,
        user: { login: "github-actions[bot]" },
        head: { sha: "abc", ref: "chore/crowdin-translations" },
        base: { ref: "main" },
        labels: [],
      }),
      "commits/abc/check-runs": JSON.stringify({ check_runs: [] }),
      "pulls/3/files": JSON.stringify([]),
      "pulls/3/reviews": JSON.stringify([]),
    });
    const ctx = await fetchPrContext("org", "repo", 3);
    expect(ctx.checks).toEqual([]);
  });

  it("queries check-runs by head.sha, not by branch ref", async () => {
    mockResponses({
      "pulls/4": JSON.stringify({
        number: 4,
        user: { login: "x" },
        head: { sha: "deadbeef", ref: "branch-name" },
        base: { ref: "main" },
        labels: [],
      }),
      "commits/deadbeef/check-runs": JSON.stringify({ check_runs: [] }),
      "pulls/4/files": JSON.stringify([]),
      "pulls/4/reviews": JSON.stringify([]),
    });
    await fetchPrContext("org", "repo", 4);
    const calls = mockExecFile.mock.calls;
    const checksCall = calls.find((c) => {
      const args = c[1] as string[];
      return args.some((a) => a.includes("check-runs"));
    });
    expect(checksCall).toBeDefined();
    const checksArgs = checksCall?.[1] as string[];
    expect(checksArgs.some((a) => a.includes("deadbeef"))).toBe(true);
    expect(checksArgs.some((a) => a.includes("branch-name"))).toBe(false);
  });

  it("includes --paginate for each multi-page endpoint", async () => {
    mockResponses({
      "pulls/5": JSON.stringify({
        number: 5,
        user: { login: "x" },
        head: { sha: "abc", ref: "chore/crowdin-translations" },
        base: { ref: "main" },
        labels: [],
      }),
      "commits/abc/check-runs": JSON.stringify({ check_runs: [] }),
      "pulls/5/files": JSON.stringify([]),
      "pulls/5/reviews": JSON.stringify([]),
    });
    await fetchPrContext("org", "repo", 5);
    const pathsWithPaginate = mockExecFile.mock.calls
      .map((c) => c[1] as string[])
      .filter((args) => args.includes("--paginate"))
      .map((args) => args[1] ?? "");
    expect(pathsWithPaginate.some((p) => p.includes("/check-runs"))).toBe(true);
    expect(pathsWithPaginate.some((p) => p.endsWith("/files"))).toBe(true);
    expect(pathsWithPaginate.some((p) => p.endsWith("/reviews"))).toBe(true);
  });
});

describe("mergePr", () => {
  it("invokes gh pr merge --squash --auto --match-head-commit <sha>", async () => {
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "" });
    await mergePr(123, "cafef00d");
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const args = mockExecFile.mock.calls[0]?.[1] as string[];
    expect(args).toEqual([
      "pr",
      "merge",
      "123",
      "--squash",
      "--auto",
      "--match-head-commit",
      "cafef00d",
    ]);
  });
});

describe("commentPr — tmp-file lifecycle", () => {
  function listTmpCommentFiles(): string[] {
    return readdirSync(tmpdir()).filter((f) => f.startsWith("crowdin-automerge-comment-"));
  }

  beforeEach(() => {
    for (const f of listTmpCommentFiles()) {
      try {
        unlinkSync(join(tmpdir(), f));
      } catch {
        // ignore
      }
    }
  });

  it("writes, invokes gh, and cleans up the tmp file on success", async () => {
    let capturedPath: string | undefined;
    mockExecFile.mockImplementation(async (_cmd: string, args: string[]) => {
      const idx = args.indexOf("--body-file");
      if (idx !== -1) {
        capturedPath = args[idx + 1];
        expect(capturedPath).toBeDefined();
        if (capturedPath) {
          expect(existsSync(capturedPath)).toBe(true);
          expect(readFileSync(capturedPath, "utf8")).toBe("hello");
        }
      }
      return { stdout: "", stderr: "" };
    });
    await commentPr(99, "hello");
    expect(capturedPath).toBeDefined();
    if (capturedPath) expect(existsSync(capturedPath)).toBe(false);
  });

  it("swallows ENOENT during cleanup (file already gone)", async () => {
    mockExecFile.mockImplementation(async (_cmd: string, args: string[]) => {
      // Pre-delete the tmp file before commentPr can clean it up.
      const idx = args.indexOf("--body-file");
      if (idx !== -1) {
        const path = args[idx + 1];
        if (path && existsSync(path)) unlinkSync(path);
      }
      return { stdout: "", stderr: "" };
    });
    await expect(commentPr(100, "body")).resolves.toBeUndefined();
  });

  it("writes --body-file, not inline --body, to avoid argv quoting limits", async () => {
    let sawBodyFile = false;
    mockExecFile.mockImplementation(async (_cmd: string, args: string[]) => {
      sawBodyFile = args.includes("--body-file");
      return { stdout: "", stderr: "" };
    });
    await commentPr(102, "x".repeat(200_000));
    expect(sawBodyFile).toBe(true);
  });

  // Ensure pre-stub written tmp files get cleaned between tests.
  afterEach(() => {
    for (const f of listTmpCommentFiles()) {
      try {
        unlinkSync(join(tmpdir(), f));
      } catch {
        // ignore
      }
    }
  });

  // Sanity: ensure the test file can write to the tmp directory.
  it("sanity check — writeFileSync to tmp works", () => {
    const p = join(tmpdir(), "crowdin-automerge-comment-sanity.txt");
    writeFileSync(p, "x");
    unlinkSync(p);
  });
});
