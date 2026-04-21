# 036. Crowdin i18n Automation Pipeline

- Status: Accepted
- Date: 2026-04-18
- Supersedes: —
- Superseded by: —

## Context

Pluralscape ships in 12 target languages via Crowdin (see ADR 035 for OTA delivery). The initial integration (PRs #465, #467) established source upload and scheduled translation pull, but lacked:

1. A glossary tailored to plurality terminology, where standard MT engines mistranslate community-specific terms like "fronting," "host," "little," and "switch."
2. Automatic pre-translation for new source strings — new English strings sat untranslated until a human translator intervened.
3. Any automated way to merge translation PRs — daily PRs required manual review despite translation files being a low-risk change surface.
4. A plan for handling target languages DeepL does not support (Arabic, Latin American Spanish).

Pluralscape has no paid Crowdin plan and no committed volunteer translators at present.

## Decision

We adopt a machine-translation pipeline with four components:

1. **Config-as-code**: `scripts/crowdin-glossary.json` is the source of truth for glossary terms. A `crowdin-config` GitHub Actions workflow applies changes to Crowdin via its API on every push to `main` touching glossary or setup files. Crowdin project state is derived; the repo is canonical.

2. **Dual MT engines**: DeepL Free for the 10 languages it supports (de, es-ES, fr, it, ja, ko, nl, pt-BR, ru, zh-CN); Google Cloud Translation for Arabic. Latin American Spanish (es-419) has no MT engine — DeepL does not support it, and Google's Crowdin integration rejects it (HTTP 400 "Languages [es-419] are not supported by Mt Engine"); `es-419` is included in the TM pass but left for human translation on the MT pass. Both engines run with glossary enforcement.

3. **Automatic pre-translation**: After the sync workflow uploads English sources to Crowdin, it runs `scripts/crowdin-pretranslate.ts` to kick off a TM + MT pre-translation job. New strings typically arrive pre-translated within a few minutes of the daily sync; the workflow allows up to 10 minutes per pre-translate pass before failing.

4. **Auto-merge for translation-only PRs**: The `crowdin-sync` workflow enables GitHub's native auto-merge on the daily translation PR via `gh pr merge --auto --squash --delete-branch`. Safety is enforced by branch protection on `main` (required status checks must pass) plus a GitHub ruleset on `chore/crowdin-translations` that restricts pushes to the Pluralscape Crowdin Bot GitHub App — only Crowdin-originated commits reach the branch, and a failing check blocks the merge. The earlier custom `crowdin-automerge` workflow and its multi-step guard chain were replaced by this native flow in PR #476.

Export policy: all translations (not just approved) are exported from Crowdin, since there are no human approvers. Manual edits in the Crowdin UI automatically supersede MT in Crowdin's translation priority ranking.

Crowdin pre-translates new strings in two passes: (1) translation memory for all
12 target languages, reusing prior translations across the project; (2) machine
translation for anything TM did not fill — DeepL for 10 languages it supports,
Google Translate for Arabic. Latin American Spanish (es-419) has no supported
MT engine and is skipped on the MT pass, staying at whatever TM provided until
a human translator edits it. All MT results are auto-approved as the shipping
translation during the transitional phase.

## Transitional posture

Until volunteer translators, contributors, or dedicated funding arrive,
Pluralscape ships MT output as its shipping translation. All pre-translations
(TM + DeepL + Google) are auto-approved in Crowdin (`autoApproveOption: "all"`).
When a volunteer translator saves an edit in the Crowdin UI, their translation
supersedes the MT in the next daily sync — no approval gate, no review buffer.
This is a deliberate tradeoff: imperfect MT-quality text in 12 target locales is
better than missing translations, and the Crowdin UI makes human override a
one-click improvement whenever volunteers arrive.

This posture will be revisited when we reach either: (1) at least one active
volunteer translator per target language, (2) funded professional translation
review, or (3) a formal translation governance model. At that point,
pretranslate will flip to `autoApproveOption: "none"` and approved-only
downloads, and a separate ADR will document the gated workflow.

## Alternatives considered

**Workflow-centric config (rejected)**: Have the setup script re-run on every sync workflow invocation. Higher API cost and couples glossary changes to sync cadence.

**Crowdin-UI managed config (rejected)**: Configure glossary, MT engines, and QA checks through the web UI only. No audit trail, no reproducibility, drift risk high.

**Approved-only export with manual review gate (deferred)**: Safest for translation quality but blocks all non-English UI until humans approve per language. Not viable without translators.

**Skip MT for Arabic and `es-419` (rejected)**: Leaves users with the English fallback. Worse UX than imperfect translation with glossary guard.

## Consequences

**Positive:**

- New English strings reach non-English users within minutes of merge.
- Glossary is version-controlled, reviewable, and auditable.
- Auto-merge removes daily friction; translation changes flow as data.
- MT failures are contained: path allowlist means an English-touching PR is never auto-merged.

**Negative:**

- MT quality for plurality-specific terminology is imperfect even with glossary enforcement. Users may see jarring translations until corrected.
- DeepL Free has a 500,000 character/month limit. Well within current scale but could become a bottleneck.
- Google Translate requires a service account key, managed via the GitHub Actions secret `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON`.

## Rollout plan

Auto-merge was initially gated behind a custom `crowdin-automerge` workflow
with a dry-run repo variable. That workflow and its guard chain were removed
in PR #476 in favour of GitHub's native auto-merge, with safety provided by
required status checks on `main` and the App-scoped ruleset on
`chore/crowdin-translations`. A maintainer can disable the flow on any given
PR by clicking "Disable auto-merge" in the GitHub UI.

## References

- ADR 035: `i18n-ota-delivery` — Crowdin OTA delivery mechanism.
- Spec: `docs/superpowers/specs/2026-04-18-crowdin-polish-design.md` (local only).
