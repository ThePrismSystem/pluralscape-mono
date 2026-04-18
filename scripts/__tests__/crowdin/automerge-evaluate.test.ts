import { describe, expect, it } from "vitest";

import {
  ACTIONABLE_SKIP_REASONS,
  evaluatePr,
  type PrContext,
} from "../../crowdin/automerge/evaluate.js";

function basePr(overrides: Partial<PrContext> = {}): PrContext {
  return {
    number: 1,
    author: "github-actions[bot]",
    headRef: "chore/crowdin-translations",
    headSha: "abc123",
    baseRef: "main",
    labels: [],
    files: [{ path: "apps/mobile/locales/fr/common.json", status: "modified" }],
    reviews: [],
    checks: [{ name: "ci", conclusion: "success" }],
    ...overrides,
  };
}

describe("evaluatePr — eligible path", () => {
  it("returns eligible with head info for a clean PR", () => {
    const result = evaluatePr(basePr({ headSha: "deadbeef" }));
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.head.sha).toBe("deadbeef");
      expect(result.head.ref).toBe("chore/crowdin-translations");
      expect(result.summary).toContain("1 files");
    }
  });

  it("accepts renamed and copied file statuses if path is in allowlist", () => {
    for (const status of ["renamed", "copied"] as const) {
      const pr = basePr({
        files: [{ path: "apps/mobile/locales/fr/common.json", status }],
      });
      expect(evaluatePr(pr).eligible).toBe(true);
    }
  });
});

describe("evaluatePr — skip reasons", () => {
  it("rejects non-bot authors", () => {
    const result = evaluatePr(basePr({ author: "someone-else" }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("author_not_bot");
  });

  it("rejects mismatched head ref", () => {
    const result = evaluatePr(basePr({ headRef: "some/other-branch" }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("branch_mismatch");
  });

  it("rejects mismatched base ref", () => {
    const result = evaluatePr(basePr({ baseRef: "develop" }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("branch_mismatch");
  });

  it("rejects when kill-switch label is applied", () => {
    const result = evaluatePr(basePr({ labels: ["do-not-automerge"] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("kill_switch_active");
  });

  it("rejects an empty PR with no_files (not path_outside_allowlist)", () => {
    const result = evaluatePr(basePr({ files: [] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("no_files");
  });

  it("rejects paths outside the locale allowlist", () => {
    const result = evaluatePr(
      basePr({ files: [{ path: "apps/mobile/src/index.ts", status: "modified" }] }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("path_outside_allowlist");
  });

  it("rejects PRs with any file deletion", () => {
    const result = evaluatePr(
      basePr({ files: [{ path: "apps/mobile/locales/fr/common.json", status: "removed" }] }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("has_deletions");
  });

  it("rejects when any review has CHANGES_REQUESTED", () => {
    const result = evaluatePr(basePr({ reviews: [{ state: "CHANGES_REQUESTED" }] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("changes_requested");
  });

  it("rejects when checks array is empty (ci_missing safety guard)", () => {
    const result = evaluatePr(basePr({ checks: [] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("ci_missing");
  });

  it("rejects when any check conclusion is still null (ci_pending)", () => {
    const result = evaluatePr(basePr({ checks: [{ name: "ci", conclusion: null }] }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("ci_pending");
  });

  it("rejects each non-passing conclusion as ci_not_green", () => {
    for (const conclusion of ["failure", "cancelled", "timed_out", "action_required"] as const) {
      const result = evaluatePr(basePr({ checks: [{ name: "ci", conclusion }] }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) expect(result.skipReason).toBe("ci_not_green");
    }
  });

  it("treats 'skipped' and 'neutral' check conclusions as passing", () => {
    for (const conclusion of ["skipped", "neutral"] as const) {
      const result = evaluatePr(basePr({ checks: [{ name: "ci", conclusion }] }));
      expect(result.eligible).toBe(true);
    }
  });
});

describe("ACTIONABLE_SKIP_REASONS", () => {
  it("excludes no_files and ci_missing (log-only reasons)", () => {
    expect(ACTIONABLE_SKIP_REASONS.has("no_files")).toBe(false);
    expect(ACTIONABLE_SKIP_REASONS.has("ci_missing")).toBe(false);
  });

  it("includes ci_pending, ci_not_green, and path_outside_allowlist (actionable)", () => {
    expect(ACTIONABLE_SKIP_REASONS.has("ci_pending")).toBe(true);
    expect(ACTIONABLE_SKIP_REASONS.has("ci_not_green")).toBe(true);
    expect(ACTIONABLE_SKIP_REASONS.has("path_outside_allowlist")).toBe(true);
  });
});
