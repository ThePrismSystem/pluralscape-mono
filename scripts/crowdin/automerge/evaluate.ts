import path from "node:path/posix";

import { EXPECTED_PATH_DEPTH, GREEN_CONCLUSIONS, REQUIRED_CHECKS } from "./evaluate.constants.js";

export const ALLOWED_LOCALES = [
  "ar",
  "de",
  "es",
  "es-419",
  "fr",
  "it",
  "ja",
  "ko",
  "nl",
  "pt-BR",
  "ru",
  "zh-Hans",
] as const;

export const BOT_AUTHOR = "github-actions[bot]";
export const EXPECTED_HEAD_REF = "chore/crowdin-translations";
export const EXPECTED_BASE_REF = "main";
export const KILL_SWITCH_LABEL = "do-not-automerge";

export type SkipReason =
  | "author_not_crowdin_bot"
  | "branch_mismatch"
  | "kill_switch_active"
  | "no_files"
  | "path_outside_allowlist"
  | "has_deletions"
  | "changes_requested"
  | "ci_missing"
  | "ci_pending"
  | "ci_not_green";

/**
 * Skip reasons that warrant a PR comment rather than silent log-only skip.
 * `ci_missing` is actionable because a required check never posting is a real
 * configuration drift: operators need to know auto-merge couldn't evaluate.
 * `no_files` stays log-only because it only fires on empty PRs that aren't
 * worth a notification round-trip.
 */
export const ACTIONABLE_SKIP_REASONS: ReadonlySet<SkipReason> = new Set<SkipReason>([
  "branch_mismatch",
  "kill_switch_active",
  "path_outside_allowlist",
  "has_deletions",
  "changes_requested",
  "ci_missing",
  "ci_pending",
  "ci_not_green",
]);

export interface PrFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied";
  /** Source path of a `renamed` or `copied` file before the move. Required
   * for rename/copy safety: both the source and destination paths must lie
   * within the locale allowlist, otherwise a rename could smuggle a non-locale
   * file into or out of the allowed tree. */
  previousFilename?: string;
}

export interface PrReview {
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
}

export interface PrCheck {
  name: string;
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "timed_out"
    | "skipped"
    | "neutral"
    | "action_required"
    | null;
}

export interface PrContext {
  number: number;
  author: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  labels: string[];
  files: PrFile[];
  reviews: PrReview[];
  checks: PrCheck[];
}

export type EvaluationResult =
  | { eligible: true; summary: string; head: { sha: string; ref: string } }
  | { eligible: false; skipReason: SkipReason };

/**
 * Returns true iff `p` is a locale-tree JSON path of the exact shape
 * `apps/mobile/locales/<locale>/<file>.json`. Paths are normalized via
 * posix path.normalize first; any segment traversal (`..`) or anything
 * that collapses to fewer than {@link EXPECTED_PATH_DEPTH} segments fails
 * closed.
 */
function isAllowedTranslationPath(rawPath: string): boolean {
  const normalized = path.normalize(rawPath);
  if (normalized.split("/").includes("..")) return false;
  const segments = normalized.split("/");
  if (segments.length !== EXPECTED_PATH_DEPTH) return false;
  const [apps, mobile, locales, locale, file] = segments;
  return (
    apps === "apps" &&
    mobile === "mobile" &&
    locales === "locales" &&
    (ALLOWED_LOCALES as readonly string[]).includes(locale ?? "") &&
    (file ?? "").endsWith(".json")
  );
}

function extractLocale(p: string): string | undefined {
  const segments = path.normalize(p).split("/");
  return segments.length === EXPECTED_PATH_DEPTH ? segments[3] : undefined;
}

/**
 * Evaluates a PR against the auto-merge eligibility rules.
 *
 * Guard order is intentional: cheap structural checks (author, branch, label,
 * file paths) run before reviews/checks so unrelated PRs exit before any
 * GitHub API calls, and so a kill-switch label takes precedence over CI state.
 */
export function evaluatePr(pr: PrContext): EvaluationResult {
  if (pr.author !== BOT_AUTHOR) {
    return { eligible: false, skipReason: "author_not_crowdin_bot" };
  }
  if (pr.headRef !== EXPECTED_HEAD_REF || pr.baseRef !== EXPECTED_BASE_REF) {
    return { eligible: false, skipReason: "branch_mismatch" };
  }
  if (pr.labels.includes(KILL_SWITCH_LABEL)) {
    return { eligible: false, skipReason: "kill_switch_active" };
  }
  if (pr.files.length === 0) {
    return { eligible: false, skipReason: "no_files" };
  }
  for (const file of pr.files) {
    if (file.status === "removed") {
      return { eligible: false, skipReason: "has_deletions" };
    }
    if (!isAllowedTranslationPath(file.path)) {
      return { eligible: false, skipReason: "path_outside_allowlist" };
    }
    if (file.status === "renamed" || file.status === "copied") {
      if (!file.previousFilename || !isAllowedTranslationPath(file.previousFilename)) {
        return { eligible: false, skipReason: "path_outside_allowlist" };
      }
    }
  }
  if (pr.reviews.some((r) => r.state === "CHANGES_REQUESTED")) {
    return { eligible: false, skipReason: "changes_requested" };
  }
  if (pr.checks.length === 0) {
    return { eligible: false, skipReason: "ci_missing" };
  }
  const checksByName = new Map<string, PrCheck>();
  for (const check of pr.checks) {
    checksByName.set(check.name, check);
  }
  for (const required of REQUIRED_CHECKS) {
    if (!checksByName.has(required)) {
      return { eligible: false, skipReason: "ci_missing" };
    }
  }
  for (const check of pr.checks) {
    if (check.conclusion === null) {
      return { eligible: false, skipReason: "ci_pending" };
    }
    if (!GREEN_CONCLUSIONS.has(check.conclusion)) {
      return { eligible: false, skipReason: "ci_not_green" };
    }
  }
  const locales = [
    ...new Set(
      pr.files.map((f) => extractLocale(f.path)).filter((l): l is string => typeof l === "string"),
    ),
  ].sort();
  const summary = `${pr.files.length} files across ${locales.length} locales: ${locales.join(", ")}`;
  return {
    eligible: true,
    summary,
    head: { sha: pr.headSha, ref: pr.headRef },
  };
}
