import { describe, expect, it } from "vitest";

import { evaluatePr } from "../../crowdin/automerge/evaluate.js";
import type { PrContext } from "../../crowdin/automerge/evaluate.js";

const basePr: PrContext = {
  number: 42,
  author: "github-actions[bot]",
  headRef: "chore/crowdin-translations",
  baseRef: "main",
  labels: ["automerge", "i18n"],
  files: [
    { path: "apps/mobile/locales/ar/common.json", status: "modified" },
    { path: "apps/mobile/locales/de/auth.json", status: "added" },
  ],
  reviews: [],
  checks: [
    { name: "Lint", conclusion: "success" },
    { name: "Tests (coverage)", conclusion: "success" },
  ],
};

describe("evaluatePr", () => {
  it("accepts translation-only PR with green CI", () => {
    const result = evaluatePr(basePr);
    expect(result.eligible).toBe(true);
    expect(result.summary).toMatch(/2 files/);
  });

  it("skips when author is not the bot", () => {
    const result = evaluatePr({ ...basePr, author: "alice" });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("author_not_bot");
  });

  it("skips when branch does not match", () => {
    const result = evaluatePr({ ...basePr, headRef: "feat/something-else" });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("branch_mismatch");
  });

  it("skips when kill-switch label present", () => {
    const result = evaluatePr({ ...basePr, labels: ["do-not-automerge"] });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("kill_switch_active");
  });

  it("rejects file outside allowlist", () => {
    const result = evaluatePr({
      ...basePr,
      files: [...basePr.files, { path: "apps/mobile/locales/en/common.json", status: "modified" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("path_outside_allowlist");
  });

  it("rejects non-JSON file even inside locale dir", () => {
    const result = evaluatePr({
      ...basePr,
      files: [{ path: "apps/mobile/locales/ar/README.md", status: "added" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("path_outside_allowlist");
  });

  it("rejects deleted file", () => {
    const result = evaluatePr({
      ...basePr,
      files: [{ path: "apps/mobile/locales/ar/common.json", status: "removed" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("has_deletions");
  });

  it("rejects pending CHANGES_REQUESTED review", () => {
    const result = evaluatePr({
      ...basePr,
      reviews: [{ state: "CHANGES_REQUESTED" }],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("changes_requested");
  });

  it("allows approving review", () => {
    const result = evaluatePr({
      ...basePr,
      reviews: [{ state: "APPROVED" }],
    });
    expect(result.eligible).toBe(true);
  });

  it("skips when a check failed", () => {
    const result = evaluatePr({
      ...basePr,
      checks: [
        { name: "Lint", conclusion: "success" },
        { name: "Tests (coverage)", conclusion: "failure" },
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("ci_not_green");
  });

  it("waits when a check is pending", () => {
    const result = evaluatePr({
      ...basePr,
      checks: [
        { name: "Lint", conclusion: "success" },
        { name: "Tests (coverage)", conclusion: null },
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.skipReason).toBe("ci_pending");
  });

  it("tolerates skipped checks", () => {
    const result = evaluatePr({
      ...basePr,
      checks: [
        { name: "Lint", conclusion: "success" },
        { name: "Optional", conclusion: "skipped" },
      ],
    });
    expect(result.eligible).toBe(true);
  });

  it("computes summary with locale count", () => {
    const result = evaluatePr({
      ...basePr,
      files: [
        { path: "apps/mobile/locales/ar/common.json", status: "modified" },
        { path: "apps/mobile/locales/ar/auth.json", status: "modified" },
        { path: "apps/mobile/locales/de/common.json", status: "modified" },
      ],
    });
    expect(result.summary).toMatch(/3 files across 2 locales: ar, de/);
  });
});
