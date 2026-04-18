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

const ALLOWED_PATH_RE = new RegExp(
  `^apps/mobile/locales/(${ALLOWED_LOCALES.join("|").replace(/\./g, "\\.")})/[^/]+\\.json$`,
);

export const BOT_AUTHOR = "github-actions[bot]";
export const EXPECTED_HEAD_REF = "chore/crowdin-translations";
export const EXPECTED_BASE_REF = "main";
export const KILL_SWITCH_LABEL = "do-not-automerge";

export type SkipReason =
  | "author_not_bot"
  | "branch_mismatch"
  | "kill_switch_active"
  | "path_outside_allowlist"
  | "has_deletions"
  | "changes_requested"
  | "ci_not_green"
  | "ci_pending";

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
  baseRef: string;
  labels: string[];
  files: PrFile[];
  reviews: PrReview[];
  checks: PrCheck[];
}

export interface EvaluationResult {
  eligible: boolean;
  skipReason?: SkipReason;
  summary?: string;
}

function extractLocale(filePath: string): string | null {
  const match = filePath.match(/^apps\/mobile\/locales\/([^/]+)\//);
  return match?.[1] ?? null;
}

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
    return { eligible: false, skipReason: "path_outside_allowlist" };
  }
  for (const file of pr.files) {
    if (file.status === "removed") {
      return { eligible: false, skipReason: "has_deletions" };
    }
    if (!ALLOWED_PATH_RE.test(file.path)) {
      return { eligible: false, skipReason: "path_outside_allowlist" };
    }
  }
  if (pr.reviews.some((r) => r.state === "CHANGES_REQUESTED")) {
    return { eligible: false, skipReason: "changes_requested" };
  }
  for (const check of pr.checks) {
    if (check.conclusion === null) {
      return { eligible: false, skipReason: "ci_pending" };
    }
    if (
      check.conclusion === "success" ||
      check.conclusion === "skipped" ||
      check.conclusion === "neutral"
    ) {
      continue;
    }
    return { eligible: false, skipReason: "ci_not_green" };
  }
  const locales = [
    ...new Set(pr.files.map((f) => extractLocale(f.path)).filter((l): l is string => l !== null)),
  ];
  locales.sort();
  const summary = `${pr.files.length} files across ${locales.length} locales: ${locales.join(", ")}`;
  return { eligible: true, summary };
}
