#!/usr/bin/env bash
# Add all Pluralscape target languages to a Crowdin project via API v2.
#
# Usage:
#   CROWDIN_PROJECT_ID=... CROWDIN_PERSONAL_TOKEN=... ./scripts/crowdin-add-target-languages.sh
#
# Idempotent — running twice is a no-op (PATCH replaces the full list).
# Language codes here are the Crowdin-side codes; the repo's crowdin.yml
# maps them to our canonical filesystem codes (e.g. es-MX -> es-419).

set -euo pipefail

: "${CROWDIN_PROJECT_ID:?CROWDIN_PROJECT_ID env var is required}"
: "${CROWDIN_PERSONAL_TOKEN:?CROWDIN_PERSONAL_TOKEN env var is required}"

TARGET_LANGUAGES=(
  "ar"      # Arabic               -> ar/
  "de"      # German               -> de/
  "es-ES"   # Spanish (generic)    -> es/       (via languages_mapping)
  "es-419"  # Spanish, Lat America -> es-419/
  "fr"      # French               -> fr/
  "it"      # Italian              -> it/
  "ja"      # Japanese             -> ja/
  "ko"      # Korean               -> ko/
  "nl"      # Dutch                -> nl/
  "pt-BR"   # Portuguese, Brazil   -> pt-BR/
  "ru"      # Russian              -> ru/
  "zh-CN"   # Chinese, Simplified  -> zh-Hans/  (via languages_mapping)
)

json_array=$(printf '"%s",' "${TARGET_LANGUAGES[@]}")
json_array="[${json_array%,}]"

payload=$(cat <<EOF
[
  { "op": "replace", "path": "/targetLanguageIds", "value": ${json_array} }
]
EOF
)

echo "Applying target languages to project ${CROWDIN_PROJECT_ID}..."
response=$(curl -sS -w "\n%{http_code}" \
  -X PATCH "https://api.crowdin.com/api/v2/projects/${CROWDIN_PROJECT_ID}" \
  -H "Authorization: Bearer ${CROWDIN_PERSONAL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${payload}")

body=$(echo "${response}" | sed '$d')
status=$(echo "${response}" | tail -n1)

if [[ "${status}" != "200" ]]; then
  echo "ERROR: Crowdin API returned HTTP ${status}" >&2
  echo "${body}" >&2
  exit 1
fi

echo "OK — target languages updated. Current list:"
echo "${body}" | jq -r '.data.targetLanguageIds[]' 2>/dev/null || echo "${body}"
