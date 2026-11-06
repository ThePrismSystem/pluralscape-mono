#!/usr/bin/env bash
# Repo-level checks. Each job in .github/workflows/repo-checks.yml runs one step,
# so a local run checks the same things. The tools must be on PATH: CI installs
# the versions pinned in the workflow.

usage() {
  cat <<USAGE
Usage: $0 <step>

Steps:
  gitleaks       Scan the whole git history for secrets
  zizmor         Audit the GitHub Actions workflows
  actionlint     Lint the GitHub Actions workflows
  typos          Spell check
  markdownlint   Lint Markdown
  commits        Check PR_TITLE and every commit from BASE_SHA to HEAD_SHA with commitlint
  all            Every step above (commits only when PR_TITLE is set)

With SARIF_DIR set, gitleaks and zizmor also write <tool>.sarif there.
USAGE
}

step_commits() {
  : "${PR_TITLE:?PR_TITLE must be set}" "${BASE_SHA:?BASE_SHA must be set}" "${HEAD_SHA:?HEAD_SHA must be set}"
  printf '%s\n' "$PR_TITLE" | pnpm exec commitlint
  pnpm exec commitlint --from "$BASE_SHA" --to "$HEAD_SHA"
}

step_gitleaks() {
  if [[ -n "${SARIF_DIR:-}" ]]; then
    mkdir -p "$SARIF_DIR"
    gitleaks git --no-banner --redact --report-format sarif --report-path "$SARIF_DIR/gitleaks.sarif"
  else
    gitleaks git --no-banner --redact
  fi
}

step_zizmor() {
  local status=0
  zizmor . || status=$?
  if [[ -n "${SARIF_DIR:-}" ]]; then
    mkdir -p "$SARIF_DIR"
    zizmor --format sarif . >"$SARIF_DIR/zizmor.sarif" || true
  fi
  return "$status"
}

step_actionlint() {
  actionlint
}

step_typos() {
  typos
}

step_markdownlint() {
  markdownlint-cli2 "**/*.md"
}

main() {
  set -euo pipefail
  local step="${1:-}"
  case "$step" in
    gitleaks | zizmor | actionlint | typos | markdownlint | commits)
      "step_$step"
      ;;
    all)
      local name
      for name in gitleaks zizmor actionlint typos markdownlint; do
        echo "-- $name"
        "step_$name"
      done
      if [[ -n "${PR_TITLE:-}" ]]; then
        echo "-- commits"
        step_commits
      fi
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

main "$@"
