import { describe, expect, it } from "vitest";

import {
  ACTIONABLE_SKIP_REASONS,
  evaluatePr,
  type PrContext,
} from "../../crowdin/automerge/evaluate.js";
import { REQUIRED_CHECKS } from "../../crowdin/automerge/evaluate.constants.js";

function greenRequiredChecks(): PrContext["checks"] {
  return REQUIRED_CHECKS.map((name) => ({ name, conclusion: "success" as const }));
}

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
    checks: greenRequiredChecks(),
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

  it("accepts renamed and copied statuses when both old and new paths are in allowlist", () => {
    for (const status of ["renamed", "copied"] as const) {
      const pr = basePr({
        files: [
          {
            path: "apps/mobile/locales/fr/common.json",
            status,
            previousFilename: "apps/mobile/locales/fr/old-common.json",
          },
        ],
      });
      expect(evaluatePr(pr).eligible).toBe(true);
    }
  });
});

describe("evaluatePr — skip reasons", () => {
  it("rejects human authors with author_not_crowdin_bot", () => {
    const result = evaluatePr(basePr({ author: "someone-else" }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("author_not_crowdin_bot");
  });

  it("rejects other bots (renovate, dependabot) with author_not_crowdin_bot", () => {
    for (const bot of ["renovate[bot]", "dependabot[bot]"]) {
      const result = evaluatePr(basePr({ author: bot }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) expect(result.skipReason).toBe("author_not_crowdin_bot");
    }
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

  it("rejects a rename from outside the allowlist into the allowlist", () => {
    const result = evaluatePr(
      basePr({
        files: [
          {
            path: "apps/mobile/locales/fr/common.json",
            status: "renamed",
            previousFilename: "package.json",
          },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("path_outside_allowlist");
  });

  it("rejects a rename that omits previousFilename", () => {
    const result = evaluatePr(
      basePr({
        files: [
          {
            path: "apps/mobile/locales/fr/common.json",
            status: "renamed",
          },
        ],
      }),
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("path_outside_allowlist");
  });

  it("rejects paths containing `..` traversal", () => {
    const result = evaluatePr(
      basePr({
        files: [{ path: "apps/mobile/locales/fr/../../../etc/passwd.json", status: "modified" }],
      }),
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

  it("rejects as ci_missing when a required check never posted", () => {
    const missingOne = REQUIRED_CHECKS.slice(1).map((name) => ({
      name,
      conclusion: "success" as const,
    }));
    const result = evaluatePr(basePr({ checks: missingOne }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("ci_missing");
  });

  it("rejects when any check conclusion is still null (ci_pending)", () => {
    const [first, ...rest] = greenRequiredChecks();
    const checks = [{ name: first?.name ?? "Lint", conclusion: null }, ...rest];
    const result = evaluatePr(basePr({ checks }));
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.skipReason).toBe("ci_pending");
  });

  it("rejects each non-passing conclusion as ci_not_green", () => {
    for (const conclusion of ["failure", "cancelled", "timed_out", "action_required"] as const) {
      const [first, ...rest] = greenRequiredChecks();
      const checks = [{ name: first?.name ?? "Lint", conclusion }, ...rest];
      const result = evaluatePr(basePr({ checks }));
      expect(result.eligible).toBe(false);
      if (!result.eligible) expect(result.skipReason).toBe("ci_not_green");
    }
  });

  it("treats 'skipped' and 'neutral' check conclusions as passing", () => {
    for (const conclusion of ["skipped", "neutral"] as const) {
      const checks = REQUIRED_CHECKS.map((name) => ({ name, conclusion }));
      const result = evaluatePr(basePr({ checks }));
      expect(result.eligible).toBe(true);
    }
  });
});

describe("ACTIONABLE_SKIP_REASONS", () => {
  it("excludes no_files (log-only) and includes ci_missing (actionable)", () => {
    expect(ACTIONABLE_SKIP_REASONS.has("no_files")).toBe(false);
    expect(ACTIONABLE_SKIP_REASONS.has("ci_missing")).toBe(true);
  });

  it("includes ci_pending, ci_not_green, and path_outside_allowlist (actionable)", () => {
    expect(ACTIONABLE_SKIP_REASONS.has("ci_pending")).toBe(true);
    expect(ACTIONABLE_SKIP_REASONS.has("ci_not_green")).toBe(true);
    expect(ACTIONABLE_SKIP_REASONS.has("path_outside_allowlist")).toBe(true);
  });
});
