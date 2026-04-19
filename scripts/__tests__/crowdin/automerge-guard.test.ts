import { describe, expect, it, vi } from "vitest";

import { runGuard, type GuardDeps } from "../../crowdin-automerge-guard.js";
import { type PrContext } from "../../crowdin/automerge/evaluate.js";
import { REQUIRED_CHECKS } from "../../crowdin/automerge/evaluate.constants.js";

function basePr(overrides: Partial<PrContext> = {}): PrContext {
  return {
    number: 123,
    author: "github-actions[bot]",
    headRef: "chore/crowdin-translations",
    headSha: "cafef00d",
    baseRef: "main",
    labels: [],
    files: [{ path: "apps/mobile/locales/fr/common.json", status: "modified" }],
    reviews: [],
    checks: REQUIRED_CHECKS.map((name) => ({ name, conclusion: "success" as const })),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<GuardDeps> = {}): GuardDeps {
  return {
    fetchPrContext: vi.fn().mockResolvedValue(basePr()),
    mergePr: vi.fn().mockResolvedValue(undefined),
    commentPr: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    env: {
      CROWDIN_AUTOMERGE_DRY_RUN: "false",
      GITHUB_STEP_SUMMARY: "/tmp/test-summary",
      GITHUB_OUTPUT: "/tmp/test-output",
    },
    appendTo: vi.fn(),
    ...overrides,
  };
}

describe("runGuard", () => {
  it("merges with head.sha when eligible and not dry-run", async () => {
    const deps = makeDeps();
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).toHaveBeenCalledWith(123, "cafef00d");
    expect(deps.commentPr).not.toHaveBeenCalled();
  });

  it("does not merge when dry-run is enabled", async () => {
    const deps = makeDeps({
      env: {
        CROWDIN_AUTOMERGE_DRY_RUN: "true",
        GITHUB_STEP_SUMMARY: "/tmp/test-summary",
        GITHUB_OUTPUT: "/tmp/test-output",
      },
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
  });

  it("defaults to dry-run when CROWDIN_AUTOMERGE_DRY_RUN is unset", async () => {
    const deps = makeDeps({
      env: { GITHUB_STEP_SUMMARY: "/tmp/s", GITHUB_OUTPUT: "/tmp/o" },
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
  });

  it("throws on any CROWDIN_AUTOMERGE_DRY_RUN value other than 'true'/'false'", async () => {
    const deps = makeDeps({
      env: {
        CROWDIN_AUTOMERGE_DRY_RUN: "yes",
        GITHUB_STEP_SUMMARY: "/tmp/s",
        GITHUB_OUTPUT: "/tmp/o",
      },
    });
    await expect(runGuard(123, "org", "repo", deps)).rejects.toThrow(
      /CROWDIN_AUTOMERGE_DRY_RUN.*true.*false/,
    );
  });

  it("throws when GITHUB_STEP_SUMMARY is missing in CI mode", async () => {
    const deps = makeDeps({
      env: { CROWDIN_AUTOMERGE_DRY_RUN: "false", GITHUB_OUTPUT: "/tmp/o", CI: "true" },
    });
    await expect(runGuard(123, "org", "repo", deps)).rejects.toThrow(/GITHUB_STEP_SUMMARY/);
  });

  it("logs the resolved dryRun value at entry", async () => {
    const log = vi.fn();
    const deps = makeDeps({
      env: {
        CROWDIN_AUTOMERGE_DRY_RUN: "true",
        GITHUB_STEP_SUMMARY: "/tmp/s",
        GITHUB_OUTPUT: "/tmp/o",
      },
      log,
    });
    await runGuard(123, "org", "repo", deps);
    const calls = log.mock.calls.map((c) => c[0] as string);
    expect(calls.some((m) => m.includes("dryRun=true"))).toBe(true);
  });

  it("comments on actionable skip reasons (e.g., kill_switch_active)", async () => {
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ labels: ["do-not-automerge"] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentPr).toHaveBeenCalled();
    const commentMock = deps.commentPr as ReturnType<typeof vi.fn>;
    const firstCall = commentMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const body = firstCall?.[1] as string;
    expect(body).toContain("kill_switch_active");
  });

  it("does not comment on non-actionable skip reasons (no_files)", async () => {
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ files: [] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.commentPr).not.toHaveBeenCalled();
  });

  it("comments on ci_missing (now actionable after required-checks allowlist)", async () => {
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ checks: [] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.commentPr).toHaveBeenCalled();
  });

  it("emits comment_failed=true to GITHUB_OUTPUT when commentPr throws", async () => {
    const appendTo = vi.fn();
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ labels: ["do-not-automerge"] })),
      commentPr: vi.fn().mockRejectedValue(new Error("comment 500")),
      appendTo,
    });
    await expect(runGuard(123, "org", "repo", deps)).resolves.toBeUndefined();
    const appendedContents = appendTo.mock.calls.map(([, content]) => String(content));
    expect(appendedContents.some((c) => c.includes("comment_failed=true"))).toBe(true);
  });

  it("skips comment when dry-run + actionable skip", async () => {
    const deps = makeDeps({
      env: {
        CROWDIN_AUTOMERGE_DRY_RUN: "true",
        GITHUB_STEP_SUMMARY: "/tmp/s",
        GITHUB_OUTPUT: "/tmp/o",
      },
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ labels: ["do-not-automerge"] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentPr).not.toHaveBeenCalled();
  });
});
