# Contributing to Pluralscape

We welcome contributions from everyone. This project is community-driven by design — the predecessor app suffered from being a one-person effort, and we are building the opposite.

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Write tests first, then implement (see [Development Methodology](#development-methodology--tdd) below)
4. Ensure all tests pass and coverage thresholds are met
5. Open a pull request against `main`

## Pull Request Process

- Use the PR template — it includes a review checklist covering privacy, offline behavior, accessibility, and data safety
- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality (written before the implementation — see [TDD](#development-methodology--tdd))
- Update documentation if behavior changes
- List any deferred work in the "Deferred Items" section of the PR template

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`, `build`

- Imperative mood, 72 characters max, no trailing period
- Branch naming: `type/short-desc` (50 chars max)

## Architecture Decisions

Major technical decisions are documented as ADRs in `docs/adr/`. If your contribution involves a significant architectural choice, please write an ADR using the template at `docs/adr/000-template.md`.

## Development Methodology — TDD

This project follows **Test-Driven Development (TDD)**. All new code should be written test-first.

### The cycle

1. **Red** — Write a test that describes the behavior you want. Run it — it should fail.
2. **Green** — Write the simplest code that makes the test pass.
3. **Refactor** — Clean up duplication, improve naming, restructure — while keeping tests green.

### In practice

- **New features**: Start by writing tests for the public API or user-facing behavior. Then build the implementation to satisfy them.
- **Bug fixes**: First write a test that reproduces the bug. Confirm it fails. Then fix the code and confirm the test passes.
- **Refactors**: Ensure existing tests cover the code you're changing. If they don't, add tests first, then refactor.

### Why TDD?

Pluralscape handles sensitive personal data (identity, fronting, journaling) with privacy and encryption guarantees. TDD helps us:

- Catch regressions in privacy and encryption logic before they ship
- Build confidence in offline-first sync behavior through repeatable tests
- Maintain high coverage naturally, without chasing metrics after the fact
- Design cleaner APIs by thinking about usage before implementation

### What if I'm not used to TDD?

That's okay — it's a practice, not a gatekeeping requirement. If you're new to TDD:

- Start small: write one test before one function
- It's fine to spike (prototype without tests) to explore an approach, then delete the spike and rebuild test-first
- Ask for help in [Discussions](https://github.com/ThePrismSystem/pluralscape-mono/discussions) if you're stuck

PRs without tests for new functionality will be asked to add them. PRs that follow the TDD cycle (test commits before implementation commits) are appreciated but not strictly required — what matters is that tests exist and cover the behavior.

## Code Standards

- We care about the quality of the code, not the tools used to write it — AI-assisted contributions are welcome
- Write tests for new functionality
- Follow existing patterns and conventions in the codebase
- Ensure accessibility (WCAG compliance) for any UI changes
- Privacy defaults to maximum restriction (fail-closed)
- Use community terminology, not clinical language — say "system" not "patient", "member" not "personality", "fronting" not "presenting"

### TypeScript Strictness

Strict typing is enforced. The following are not permitted:

- **No `as any`** — find the correct type or fix the type upstream
- **No `as unknown as T`** — this is a double-cast escape hatch; restructure the code instead
- **No `@ts-ignore`** — if the compiler is wrong, use `@ts-expect-error` with a comment explaining why
- **No `@ts-expect-error` without a justification comment** — explain the specific compiler limitation
- **No `eslint-disable` comments** — fix the violation or raise a discussion about the rule
- **No non-null assertions (`!`)** — use narrowing, early returns, or explicit checks instead
- **No `var`** — use `const` by default, `let` only when reassignment is necessary

`as never` is allowed only in exhaustive switch/match default cases to enforce compile-time exhaustiveness:

```typescript
// correct usage of `as never`
switch (status) {
  case "fronting": ...
  case "co-fronting": ...
  default: {
    const _exhaustive: never = status;
    throw new Error(`Unhandled status: ${_exhaustive}`);
  }
}
```

### Code Quality

- **Explicit return types on exported functions** — inferred types are fine for internal/private functions
- **No floating promises** — all promises must be `await`ed, returned, or explicitly voided with `void`
- **No swallowed errors** — every `catch` must log, rethrow, or handle meaningfully. Empty catch blocks are not permitted
- **No `console.log` in production code** — use structured logging. `console.log` is acceptable in scripts and tests only
- **Prefer early returns** over deeply nested conditionals
- **Exhaustive pattern matching** — all `switch` statements on union types must handle every case (use `as never` default)
- **No magic numbers/strings** — extract to `*.constants.ts` files. Each package/domain has its own (e.g., `crypto.constants.ts`, `middleware.constants.ts`). The ESLint config disables `no-magic-numbers` for this glob. Every constant needs a JSDoc comment and should use numeric underscores for readability (`86_400` not `86400`). When adding a constant, extend the nearest existing `*.constants.ts`; only create a new file when entering a new domain.

### Mobile Development

All interactive UI elements must have accessibility props (`accessibilityLabel`, `accessibilityRole`) with minimum 44x44pt touch targets.

For hook conventions, offline-first patterns, the provider tree architecture, platform abstraction, and a walkthrough of adding new features end-to-end, see the [Mobile Developer Guide](docs/guides/mobile-developer-guide.md).

### Adding API Endpoints

Every new API feature requires both a REST route and a tRPC procedure. The CI check (`pnpm trpc:parity`) enforces this.

Checklist:

1. Add REST route in `apps/api/src/routes/`
2. Add tRPC procedure in the matching router under `apps/api/src/trpc/routers/`
3. Apply matching rate limit middleware on both (see table below)
4. Apply matching auth level on both
5. Import input validation from `@pluralscape/validation` — do not define inline Zod schemas
6. Write unit tests for the procedure and route handler
7. Write integration tests covering success, not-found, and unauthorized
8. Run `pnpm trpc:parity` — must pass before opening a PR

If the new endpoint is REST-only by design (SSE, infrastructure), add an entry to `apps/api/scripts/trpc-parity.config.ts` with a documented reason.

#### Rate limit categories

| Category           | Limit      | Use for                               |
| ------------------ | ---------- | ------------------------------------- |
| `readDefault`      | 60 req/min | Standard read operations              |
| `readHeavy`        | 30 req/min | Expensive reads (reports, analytics)  |
| `write`            | 60 req/min | Standard create/update/delete         |
| `authHeavy`        | 5 req/min  | Login, password reset, token exchange |
| `authLight`        | 20 req/min | Session refresh, token validation     |
| `blobUpload`       | 20 req/min | File and photo uploads                |
| `auditQuery`       | 10 req/min | Audit log and delivery log reads      |
| `friendCodeRedeem` | 10 req/min | Friend code redemption                |

Rate limit categories are defined in `@pluralscape/types`. Use the exact same category on the REST route and the tRPC procedure — the parity check flags mismatches.

### Linting

Zero warnings are tolerated. All ESLint warnings are treated as errors in CI, git hooks, and local scripts (`--max-warnings 0`). If a rule is too noisy, discuss changing its severity — do not leave warnings in the codebase.

### Test Coverage Requirements

Test coverage is enforced in CI. The thresholds below are minimums — aim higher where practical.

| Test Type   | Coverage Target              | Tool       | What It Covers                                     |
| ----------- | ---------------------------- | ---------- | -------------------------------------------------- |
| Unit        | 85% lines/functions/branches | Vitest     | Pure functions, utilities, domain logic            |
| Integration | 85% lines/functions/branches | Vitest     | API routes, database queries, cross-module flows   |
| E2E         | Critical paths               | Playwright | User-facing flows: auth, fronting, switching, sync |

- **Unit + Integration** (85% combined): Lines, functions, branches, and statements are all measured. Type-only files and barrel/index files are excluded from coverage. Measured across the combined unit + integration run.
- **E2E tests**: No line-coverage metric — instead, all critical user journeys must have corresponding tests. Tracked via a test matrix in the test plan.

Coverage is checked in CI on every PR. PRs that drop coverage below thresholds will not merge.

### Accessibility

- All interactive elements must have accessibility props (`accessibilityLabel`, `accessibilityRole`, etc.)
- Color must not be the only means of conveying information
- Touch targets must meet minimum size (44x44pt)
- Test with screen readers (VoiceOver on iOS, TalkBack on Android)

## Translations

Pluralscape uses [Crowdin](https://crowdin.com) for translation management. The project qualifies for the free open-source tier.

### How translations flow

1. English sources (`apps/mobile/locales/en/**/*.json`) are the source of truth.
2. On merge to `main`, a GitHub Action uploads changed source strings to Crowdin.
3. Translators work in Crowdin's web UI. Strings carry community-terminology notes (plural-community affirming language — never clinical).
4. Every Monday at 06:00 UTC, a scheduled Action pulls approved translations and opens a PR titled `chore(i18n): weekly Crowdin translation sync`. Maintainers review the diff and merge.

### Proposing a new locale

1. Open a bean tracking the locale request.
2. Add the locale tag to `SUPPORTED_LOCALES` in `packages/i18n/src/i18n.constants.ts` and `BUNDLED_LOCALES` in `apps/mobile/locales/index.ts`.
3. Update `crowdin.yml` `languages_mapping` if the Crowdin locale tag differs from the Pluralscape tag.
4. Add an empty baseline directory `apps/mobile/locales/<locale>/` with empty namespace JSON stubs; Crowdin will populate them.
5. Verify with `pnpm vitest run --project i18n`.

### Runtime delivery

Apps ship with bundled baseline translations for offline-first behavior. Translation fixes reach users via an API-proxied OTA overlay (`GET /v1/i18n/:locale/:namespace`) without requiring an app release. See `docs/adr/035-i18n-ota-delivery.md` for details.

## Feature Requests and Voting

Feature prioritization is community-driven. If you have a feature idea:

1. Check existing [Discussions](https://github.com/ThePrismSystem/pluralscape-mono/discussions) and issues to avoid duplicates
2. Open a thread in the [Feature Requests](https://github.com/ThePrismSystem/pluralscape-mono/discussions/categories/feature-requests) discussion category
3. Community upvotes help prioritize what gets built next

## Reporting Issues

- **Bugs**: Open a GitHub issue with steps to reproduce
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) — do not open a public issue

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). We have zero tolerance for bigotry, harassment, or gatekeeping.

## Adding user-facing strings

English sources live in `apps/mobile/locales/en/*.json`. To add or modify a user-facing string:

1. Add the key + English value to the appropriate file (`auth.json`, `common.json`, `fronting.json`, `members.json`, `settings.json`).
2. Reference the key from the mobile UI via the i18n hook.
3. Commit and open a PR as usual.

Translations are handled automatically:

- On merge to `main`, the `crowdin-sync` workflow uploads the new source to Crowdin and triggers machine-translation (TM + MT with glossary enforcement) for all 12 target languages.
- The next daily sync (06:00 UTC) opens a translation PR that auto-merges once CI passes.

If you're adding domain terminology (plurality, fronting, member roles, origins, etc.), check `scripts/crowdin-glossary.json` first — the term may already be defined. If not, consider adding it in the same PR.

See `docs/i18n/crowdin-operations.md` for operational details.
