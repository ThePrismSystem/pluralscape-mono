import { afterEach, describe, expect, it, vi } from "vitest";

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
const { fetchPrContext } = await import("../../crowdin/automerge/gh.js");

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
    expect(ctx.files).toEqual([{ path: "apps/mobile/locales/fr/common.json", status: "modified" }]);
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
    // Verify the path used contains the SHA, not the ref.
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
});
