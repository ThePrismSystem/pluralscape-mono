#!/usr/bin/env bash
set -euo pipefail

if ! command -v codeql &>/dev/null; then
  echo "CodeQL CLI not found. Install via: bash scripts/codeql/install.sh"
  echo "Skipping analysis."
  exit 0
fi

DB_DIR=".codeql-db"
RESULTS_DIR=".codeql-results"

rm -rf "$DB_DIR" "$RESULTS_DIR"
mkdir -p "$DB_DIR" "$RESULTS_DIR"

echo "=== JavaScript/TypeScript analysis ==="
echo "Creating database..."
codeql database create "$DB_DIR/javascript" --language=javascript --overwrite --source-root=.

echo "Running analysis..."
codeql database analyze "$DB_DIR/javascript" \
  --format=sarif-latest \
  --output="$RESULTS_DIR/javascript.sarif" \
  -- codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls

echo ""
echo "=== GitHub Actions analysis ==="
echo "Creating database..."
codeql database create "$DB_DIR/actions" --language=actions --overwrite --source-root=.

echo "Running analysis..."
codeql database analyze "$DB_DIR/actions" \
  --format=sarif-latest \
  --output="$RESULTS_DIR/actions.sarif" \
  -- codeql/actions-queries

echo ""
echo "Results written to $RESULTS_DIR/"

if command -v jq &>/dev/null; then
  for f in "$RESULTS_DIR"/*.sarif; do
    name=$(basename "$f" .sarif)
    count=$(jq '[.runs[].results[]] | length' "$f")
    echo "  $name: $count issue(s)"
  done
else
  echo "Install jq to see a summary of results."
fi
