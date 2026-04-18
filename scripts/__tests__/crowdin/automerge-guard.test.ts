import { describe, expect, it, vi } from "vitest";

import { runGuard, type GuardDeps } from "../../crowdin-automerge-guard.js";
import { type PrContext } from "../../crowdin/automerge/evaluate.js";

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
    checks: [{ name: "ci", conclusion: "success" }],
    ...overrides,
  };
}

function makeDeps(overrides: Partial<GuardDeps> = {}): GuardDeps {
  return {
    fetchPrContext: vi.fn().mockResolvedValue(basePr()),
    mergePr: vi.fn().mockResolvedValue(undefined),
    commentPr: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    env: { CROWDIN_AUTOMERGE_DRY_RUN: "false" },
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

  it("does not merge when dry-run is enabled (default)", async () => {
    const deps = makeDeps({ env: { CROWDIN_AUTOMERGE_DRY_RUN: "true" } });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
  });

  it("does not merge when dry-run var is unset (defaults to dry-run)", async () => {
    const deps = makeDeps({ env: {} });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
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

  it("does not comment on ci_missing (log-only)", async () => {
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ checks: [] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.commentPr).not.toHaveBeenCalled();
  });

  it("does not propagate a commentPr failure", async () => {
    const deps = makeDeps({
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ labels: ["do-not-automerge"] })),
      commentPr: vi.fn().mockRejectedValue(new Error("comment 500")),
    });
    await expect(runGuard(123, "org", "repo", deps)).resolves.toBeUndefined();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("comment failed"));
  });

  it("skips comment when dry-run + actionable skip", async () => {
    const deps = makeDeps({
      env: { CROWDIN_AUTOMERGE_DRY_RUN: "true" },
      fetchPrContext: vi.fn().mockResolvedValue(basePr({ labels: ["do-not-automerge"] })),
    });
    await runGuard(123, "org", "repo", deps);
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentPr).not.toHaveBeenCalled();
  });
});
