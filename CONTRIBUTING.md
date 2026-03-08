# Contributing to Pluralscape

We welcome contributions from everyone. This project is community-driven by design — the predecessor app suffered from being a one-person effort, and we are building the opposite.

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes
4. Ensure tests pass
5. Open a pull request against `main`

## Pull Request Process

- Use the PR template — it includes a review checklist covering privacy, offline behavior, accessibility, and data safety
- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
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
- **No magic numbers/strings** — extract to named constants

### Linting

Zero warnings are tolerated. All ESLint warnings are treated as errors in CI, git hooks, and local scripts (`--max-warnings 0`). If a rule is too noisy, discuss changing its severity — do not leave warnings in the codebase.

### Test Coverage Requirements

Test coverage is enforced in CI. The thresholds below are minimums — aim higher where practical.

| Test Type   | Coverage Target | Tool       | What It Covers                                     |
| ----------- | --------------- | ---------- | -------------------------------------------------- |
| Unit        | 80% lines       | Vitest     | Pure functions, utilities, domain logic            |
| Integration | 70% lines       | Vitest     | API routes, database queries, cross-module flows   |
| E2E         | Critical paths  | Playwright | User-facing flows: auth, fronting, switching, sync |

- **Unit tests** (80%): Every package in `packages/` and business logic in `apps/` must meet this threshold. Measured per-package.
- **Integration tests** (70%): API endpoint handlers, database operations, and cross-package interactions. Measured per-app.
- **E2E tests**: No line-coverage metric — instead, all critical user journeys must have corresponding tests. Tracked via a test matrix in the test plan.

Coverage is checked in CI on every PR. PRs that drop coverage below thresholds will not merge.

### Accessibility

- All interactive elements must have accessibility props (`accessibilityLabel`, `accessibilityRole`, etc.)
- Color must not be the only means of conveying information
- Touch targets must meet minimum size (44x44pt)
- Test with screen readers (VoiceOver on iOS, TalkBack on Android)

## Feature Requests and Voting

Feature prioritization is community-driven. If you have a feature idea:

1. Check existing beans/issues to avoid duplicates
2. Open a discussion or issue describing the feature and its value to the plural community
3. Community voting helps prioritize what gets built next

## Reporting Issues

- **Bugs**: Open a GitHub issue with steps to reproduce
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md) — do not open a public issue

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). We have zero tolerance for bigotry, harassment, or gatekeeping.
