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
  | "author_not_bot"
  | "branch_mismatch"
  | "kill_switch_active"
  | "no_files"
  | "path_outside_allowlist"
  | "has_deletions"
  | "changes_requested"
  | "ci_missing"
  | "ci_pending"
  | "ci_not_green";

export const ACTIONABLE_SKIP_REASONS: ReadonlySet<SkipReason> = new Set<SkipReason>([
  "branch_mismatch",
  "kill_switch_active",
  "path_outside_allowlist",
  "has_deletions",
  "changes_requested",
  "ci_pending",
  "ci_not_green",
]);

export interface PrFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied";
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

function isAllowedTranslationPath(p: string): boolean {
  const segments = p.split("/");
  if (segments.length !== 5) return false;
  const [apps, mobile, locales, locale, file] = segments;
  return (
    apps === "apps" &&
    mobile === "mobile" &&
    locales === "locales" &&
    (ALLOWED_LOCALES as readonly string[]).includes(locale ?? "") &&
    (file ?? "").endsWith(".json")
  );
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
    return { eligible: false, skipReason: "author_not_bot" };
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
  }
  if (pr.reviews.some((r) => r.state === "CHANGES_REQUESTED")) {
    return { eligible: false, skipReason: "changes_requested" };
  }
  if (pr.checks.length === 0) {
    return { eligible: false, skipReason: "ci_missing" };
  }
  for (const check of pr.checks) {
    if (check.conclusion === null) {
      return { eligible: false, skipReason: "ci_pending" };
    }
    if (
      check.conclusion !== "success" &&
      check.conclusion !== "skipped" &&
      check.conclusion !== "neutral"
    ) {
      return { eligible: false, skipReason: "ci_not_green" };
    }
  }
  const locales = [
    ...new Set(
      pr.files.map((f) => f.path.split("/")[3]).filter((l): l is string => typeof l === "string"),
    ),
  ].sort();
  const summary = `${pr.files.length} files across ${locales.length} locales: ${locales.join(", ")}`;
  return {
    eligible: true,
    summary,
    head: { sha: pr.headSha, ref: pr.headRef },
  };
}
