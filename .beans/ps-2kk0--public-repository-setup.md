---
# ps-2kk0
title: Public repository setup
status: completed
type: task
priority: normal
created_at: 2026-03-08T09:42:00Z
updated_at: 2026-04-16T07:29:40Z
parent: ps-jvnm
---

Configure GitHub repo for public access: discussions, branch protection, labels, issue templates, dependabot, CODEOWNERS, roadmap workflow

## Summary of Changes

- Set repo description and 12 topics (plurality, DID, OSDD, privacy, etc.)
- Enabled GitHub Discussions
- Created custom labels: 4 type labels, 6 domain labels, 5 area labels; deleted 5 default labels
- Created branch protection ruleset on main: require PR with 1 review, dismiss stale reviews, require conversation resolution, require Lint + Typecheck status checks (strict), no force pushes, no deletions, admin bypass
- Enabled dependabot security updates, secret scanning, push protection
- Created issue templates: bug report form + config (no blank issues, links to discussions + security advisories)
- Created CODEOWNERS
- Created dependabot.yml (npm weekly grouped, GitHub Actions weekly)
- Created roadmap workflow (auto-regenerate on .beans/ changes)
- Added `pnpm roadmap` script
- Generated initial docs/roadmap.md
- Updated CONTRIBUTING.md feature requests section to point to Discussions
