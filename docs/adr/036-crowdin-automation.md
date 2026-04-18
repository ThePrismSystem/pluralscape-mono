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

2. **Dual MT engines**: DeepL Free for the 10 languages it supports (de, es, fr, it, ja, ko, nl, pt-BR, ru, zh-Hans); Google Cloud Translation for the two it does not (ar, es-419). Both engines run with glossary enforcement.

3. **Automatic pre-translation**: After the sync workflow uploads English sources to Crowdin, it runs `scripts/crowdin-pretranslate.ts` to kick off a TM + MT pre-translation job. New strings arrive translated (unapproved) within ~1 minute.

4. **Auto-merge for translation-only PRs**: A `crowdin-automerge` workflow evaluates a 7-step guard chain (author, branch, label, path allowlist, no deletions, reviews, CI status) and squash-merges eligible PRs. `apps/mobile/locales/en/**` is explicitly excluded from the allowlist so a mixed-content PR is always rejected.

Export policy: all translations (not just approved) are exported from Crowdin, since there are no human approvers. Manual edits in the Crowdin UI automatically supersede MT in Crowdin's translation priority ranking.

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
- Google Translate requires a service account key, which needs careful secret management.

**Transitional posture:**

MT is a bootstrap strategy, not the end state. Pluralscape commits to superseding MT output with community-contributed translations as soon as volunteer translators or donation-funded professional localization become available. At that point we will:

1. Re-evaluate the "export all translations" policy — likely switch to approved-only export per language as translators opt in.
2. Add per-language DeepL/Google glossaries with volunteer-validated target translations.
3. Potentially tighten the auto-merge gate (e.g., require approved-translation status, or add a human review checkpoint).
4. Update this ADR with the new approach.

## References

- ADR 035: `i18n-ota-delivery` — Crowdin OTA delivery mechanism.
- Spec: `docs/superpowers/specs/2026-04-18-crowdin-polish-design.md` (local only).
