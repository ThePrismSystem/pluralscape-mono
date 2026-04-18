# Crowdin i18n Operations

Runbook for the automated localization pipeline. Architecture decisions live in `docs/adr/036-crowdin-automation.md`.

## Pipeline overview

1. Developer commits English strings to `apps/mobile/locales/en/*.json` on `main`.
2. `crowdin-sync` workflow uploads sources to Crowdin and runs `crowdin:pretranslate` to fill new strings via TM + MT (DeepL for 10 languages, Google Translate for `ar` and `es-419`), enforcing `scripts/crowdin-glossary.json`.
3. Daily at 06:00 UTC, `crowdin-sync` downloads updated translations and opens a PR to `chore/crowdin-translations`.
4. CI runs on the PR. On completion, `crowdin-automerge` evaluates the guard chain and merges if eligible.
5. Glossary changes on `main` trigger `crowdin-config` to reapply Crowdin project configuration.

## Glossary maintenance

Source of truth: `scripts/crowdin-glossary.json`.

To add, change, or remove a term:

1. Edit the JSON file.
2. Run locally to validate: `pnpm vitest run --project scripts crowdin-glossary-schema`.
3. Commit and open a PR.
4. On merge to `main`, the `crowdin-config` workflow reapplies the glossary to Crowdin.

The glossary schema enforces no duplicate terms, required `notes`, valid `type` and `hazard` enums. See `scripts/crowdin-glossary.schema.json`.

## Adding a target language

1. Edit `scripts/crowdin/languages.ts` — append the Crowdin-side language ID to `TARGET_LANGUAGE_IDS`.
2. Edit `scripts/crowdin/mt.ts` — add the locale to `ENGINE_ROUTING` with `"deepl"` or `"google"`.
3. Edit `scripts/crowdin/automerge/evaluate.ts` — append the repo-side locale (if different from Crowdin's code) to `ALLOWED_LOCALES`.
4. Edit `crowdin.yml` — add a `languages_mapping` entry if the Crowdin ID differs from the repo directory name.
5. Edit `.github/workflows/crowdin-sync.yml` — nothing to change; the crowdin-action reads from `crowdin.yml`.
6. Commit and merge. The `crowdin-config` workflow syncs Crowdin's target language list.

## Pausing auto-merge

Add the `do-not-automerge` label to the open Crowdin PR. The guard will skip it with `skip_reason=kill_switch_active`. Remove the label to resume.

To pause the entire pipeline (e.g., before a release freeze), disable the `crowdin-automerge` workflow in the GitHub Actions UI.

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

Requires the four env vars in `.env.example` set; load via `source .env` if needed.

**Dry-run the setup (shows intended changes without mutating):**

```bash
pnpm crowdin:setup --dry-run
```

## Debugging

**Auto-merge didn't fire:**

- Open the PR → Checks tab → find the `crowdin-automerge` run.
- The Step Summary explains `skipped` reason and the job comment on the PR does too.
- If `ci_pending`, the workflow will re-evaluate on the next `check_suite: completed` event.
- If `ci_not_green`, fix the failing check; the next sync will reopen a fresh PR.

**Pre-translate failed:**

- Check the `crowdin-sync` workflow run.
- Common causes: DeepL API quota exhausted (500k chars/month on Free), stale Crowdin token.

**Config drift:**

- The `crowdin-config` workflow auto-opens a GitHub issue on failure; check the `automation-failure` label.
- Or run `pnpm crowdin:setup --dry-run` locally to see what Crowdin would change.

## Volunteer translator onboarding (future)

When volunteers are available:

1. Add them as Crowdin project translators via the UI.
2. Consider re-evaluating the "export all translations" policy — if approvers are available per language, switch to approved-only export.
3. Document their preferred term translations in per-language DeepL glossaries (not yet implemented).
