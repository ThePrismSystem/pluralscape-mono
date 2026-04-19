/**
 * Expected path depth for files eligible for auto-merge. The allowlist requires
 * paths shaped exactly `apps/mobile/locales/<locale>/<file>.json` — five
 * `/`-separated segments. This is enforced both in the path-allowlist check
 * and again when extracting locales for the summary line.
 */
export const EXPECTED_PATH_DEPTH = 5;

/**
 * Check-run conclusions treated as "green" for auto-merge. `success` is
 * obvious; `skipped` covers conditional jobs that weren't applicable; `neutral`
 * is GitHub's "informational, not blocking" signal.
 */
export const GREEN_CONCLUSIONS: ReadonlySet<string> = new Set(["success", "skipped", "neutral"]);

/**
 * Required CI check names for auto-merge. Each name must appear in the PR's
 * `check_runs` list with a conclusion in {@link GREEN_CONCLUSIONS}. If any
 * required check is missing, the guard emits `ci_missing` (actionable) so the
 * bot PR is not merged past an unreported required job.
 *
 * Names match the `name:` fields of jobs in `.github/workflows/ci.yml`. Keep
 * in sync with the repository's branch-protection "required status checks" — a
 * drift here means the guard could merge past a check that branch protection
 * separately blocks, making operators think auto-merge is broken.
 */
export const REQUIRED_CHECKS: readonly string[] = [
  "Lint",
  "Typecheck",
  "Tests (coverage)",
  "E2E Tests",
  "Migration Freshness",
  "Security Audit",
  "OpenAPI Spec Reconciliation",
  "tRPC Parity Check",
  "Scope Coverage Check",
];
