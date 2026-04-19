# Crowdin i18n Operations

Runbook for the automated localization pipeline. Architecture decisions live in `docs/adr/036-crowdin-automation.md`.

## Pipeline overview

1. Developer commits English strings to `apps/mobile/locales/en/*.json` on `main`.
2. `crowdin-sync` workflow uploads sources to Crowdin and runs `crowdin:pretranslate` to fill new strings via TM + MT (DeepL for 10 languages, Google Translate for `ar` and `es-419`), enforcing `scripts/crowdin-glossary.json`.
3. Daily at 06:00 UTC, `crowdin-sync` downloads updated translations and opens a PR to `chore/crowdin-translations`.
4. The `crowdin-sync` workflow enables GitHub native auto-merge on the PR it just created. Branch protection on `main` holds the PR until required status checks pass, then GitHub merges it automatically.
5. Glossary changes on `main` trigger `crowdin-config` to reapply Crowdin project configuration.

The `chore/crowdin-translations` branch is protected by a repo ruleset that restricts creation, updates, and deletion to the **Pluralscape Crowdin Bot** GitHub App (the only bypass actor besides repo admins). The workflow mints a short-lived installation token from this App per run and uses it for checkout, the crowdin-action's git push, and the auto-merge enable call — so only Crowdin-originated commits can ever land on that branch.

## Glossary maintenance

Source of truth: `scripts/crowdin-glossary.json`.

To add, change, or remove a term:

1. Edit the JSON file.
2. Run locally to validate: `pnpm vitest run scripts/__tests__/crowdin-glossary-schema.test.ts`.
3. Commit and open a PR.
4. On merge to `main`, the `crowdin-config` workflow reapplies the glossary to Crowdin.

The glossary schema enforces no duplicate terms, required `notes`, valid `type` and `hazard` enums. See `scripts/crowdin-glossary.schema.json`.

## Adding a target language

1. Edit `scripts/crowdin/languages.ts` — append the Crowdin-side language ID to `TARGET_LANGUAGE_IDS`.
2. Edit `scripts/crowdin/mt.ts` — add the locale to `ENGINE_ROUTING` with `"deepl"` or `"google"`.
3. Create the repo-side directory: `mkdir apps/mobile/locales/<locale>` (the `locale-parity` test derives the allowed locale list from the filesystem, so the directory existing is what gates the parity check).
4. Edit `crowdin.yml` — add a `languages_mapping` entry if the Crowdin ID differs from the repo directory name.
5. Edit `.github/workflows/crowdin-sync.yml` — nothing to change; the crowdin-action reads from `crowdin.yml`.
6. Commit and merge. The `crowdin-config` workflow syncs Crowdin's target language list.

## Pausing auto-merge

To pause a single open PR: `gh pr merge <num> --disable-auto` (or click "Disable auto-merge" in the PR UI). The PR stays open for manual review; re-enable with `gh pr merge <num> --auto --squash` when ready.

To pause the entire pipeline (e.g., before a release freeze), disable the `crowdin-sync` workflow in the GitHub Actions UI — this stops new translation PRs from being opened. Close any in-flight PR manually.

## Manual operations

**Re-run sync out of band:**

```bash
gh workflow run crowdin-sync.yml
```

**Pre-translate a specific language:**

```bash
pnpm crowdin:pretranslate --languages ar
```

**Apply config to Crowdin manually (local):**

```bash
pnpm crowdin:setup
```

Requires the four env vars (2 Crowdin + DeepL + one of 2 Google credential variants) in `.env.example` set; load via `source .env` if needed.

**Dry-run the setup (shows intended changes without mutating):**

```bash
pnpm crowdin:setup --dry-run
```

## Debugging

**Auto-merge didn't fire:**

- Open the PR — the header shows the auto-merge status (enabled / blocked / not enabled).
- Not enabled → check the `crowdin-sync` workflow run → "Enable native auto-merge on translation PR" step logs. If it reported "No open translation PR found," the crowdin-action failed earlier in the job.
- Enabled but not merging → the PR is blocked on required status checks. Click "Details" on any failing check to investigate.
- Ruleset rejection (`chore/crowdin-translations` push denied) → verify `CROWDIN_APP_ID` / `CROWDIN_APP_PRIVATE_KEY` secrets are current and the App is still installed on the repo. The ruleset's bypass actor must match the App's installation ID.

**Pre-translate failed:**

- Check the `crowdin-sync` workflow run.
- Common causes: DeepL API quota exhausted (500k chars/month on Free), stale Crowdin token.

**Config drift:**

- The `crowdin-config` workflow auto-opens a GitHub issue on failure; check the `automation-failure` label.
- Or run `pnpm crowdin:setup --dry-run` locally to see what Crowdin would change.

## Reverting a bad auto-merged translation

If auto-merge lands a translation that's embarrassingly wrong, offensive, or
breaks the app:

1. Find the merge commit on `main` with `git log --oneline --merges --author="github-actions" --grep="Crowdin"` — the most recent is usually the culprit.
2. Revert it on a new branch and open a PR:

   ```bash
   git fetch origin main
   git checkout -b revert/crowdin-<locale>-<date> origin/main
   git revert -m 1 <merge-sha>
   git push -u origin HEAD
   gh pr create --title "revert: bad translation in <locale>" \
     --body "Reverts $(git rev-parse <merge-sha>) — see runbook for context."
   ```

3. Disable auto-merge on the _next_ Crowdin PR (`gh pr merge <num> --disable-auto`) so a maintainer reviews the replacement translation manually before merging.

The wrong translation remains visible in Crowdin until a translator corrects
the source. Pre-empt by saving a better translation directly in the Crowdin
UI — the next sync pulls it.

## DeepL quota

DeepL Free is capped at 500K characters/month. Pre-translate consumes quota
only on _new or changed_ source strings, so typical monthly usage is well
below the cap. Monitor at https://www.deepl.com/pro-account/usage. If usage
trends above 400K/month, upgrade to DeepL Pro or narrow the pre-translate
language scope with `--languages de,es-ES,fr`. The sync workflow does not
currently alert on quota exhaustion; a quota-exceeded request fails the
pre-translate pass, surfacing in the Actions run. Consider a monthly manual
check during the dry-run rollout window.

## Token and secret ownership

- `CROWDIN_PERSONAL_TOKEN` — Pluralscape-owned Crowdin personal access token with full project rights. Rotate quarterly via the Crowdin account settings UI and update the GitHub Actions secret.
- `DEEPL_API_KEY` — Pluralscape-owned DeepL account. Rotate on compromise only.
- `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON` — service account JSON for `pluralscape-i18n@...` in the Pluralscape GCP project. Rotate via `gcloud iam service-accounts keys create` + updating the repo secret; deactivate the old key within 24 hours.
- `CROWDIN_APP_ID` — numeric ID of the Pluralscape Crowdin Bot GitHub App. Visible on the App's settings page; only changes if the App is recreated.
- `CROWDIN_APP_PRIVATE_KEY` — `.pem` contents for the same App. Rotate by generating a new key on the App settings page (Private keys → Generate) and updating the secret; delete the old key within 24 hours. If the App is ever reinstalled, also update the ruleset bypass `actor_id` (see Debugging).

All three live in GitHub Actions repo secrets; local dev values are in
`.env.sp-test`-style files (gitignored).

## How volunteer translators improve MT output

Any translation entered in the Crowdin editor supersedes the MT in the next
daily sync. Volunteers don't need to wait for approval from a Pluralscape
maintainer — all translations saved in the Crowdin editor are auto-approved
immediately during the MT-only phase, matching how MT output is auto-approved.
Steps:

1. Log into Crowdin, open the Pluralscape project, pick a target language.
2. Edit any string — the editor shows the current MT text, the source English, glossary terms, and any source-string context.
3. Save. Your translation is approved automatically; it lands in the daily sync PR within 24 hours.

If you see an MT translation that's wrong, harmful, or uses gatekept
terminology, edit it — even a literal retranslation is an improvement over the
MT default.

## Adding source string context

When you add a new English string to `apps/mobile/locales/en/<namespace>.json`,
add a parallel entry to `<namespace>.context.json` describing the string for
translators — where it appears, tone, variable meaning, length constraints,
"do not translate" flags. Context is uploaded automatically by the daily sync
workflow. To preview the upload locally:

```bash
pnpm crowdin:upload-context --dry-run
```

Contexts persist on the source string — Crowdin retains them across
re-uploads. Translators see them in the editor pane alongside the glossary.
