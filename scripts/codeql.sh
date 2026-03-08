#!/usr/bin/env bash
set -euo pipefail

if ! command -v codeql &>/dev/null; then
  echo "CodeQL CLI not found. Install from: https://github.com/github/codeql-cli-binaries/releases"
  echo "Skipping analysis."
  exit 0
fi

DB_DIR=".codeql-db"
RESULTS_DIR=".codeql-results"

rm -rf "$DB_DIR" "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

echo "Creating CodeQL database..."
codeql database create "$DB_DIR" --language=javascript --overwrite --source-root=.

echo "Running analysis..."
codeql database analyze "$DB_DIR" \
  --format=sarif-latest \
  --output="$RESULTS_DIR/results.sarif" \
  -- codeql/javascript-queries:codeql-suites/javascript-security-and-quality-query-suite.qls

echo "Results written to $RESULTS_DIR/results.sarif"

# Print summary of any findings
if command -v jq &>/dev/null; then
  count=$(jq '[.runs[].results[]] | length' "$RESULTS_DIR/results.sarif")
  echo "Found $count issue(s)."
else
  echo "Install jq to see a summary of results."
fi
