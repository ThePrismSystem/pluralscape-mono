---
# infra-nbr3
title: Apply repo rules, signed commits, and repo-level CI checks
status: in-progress
type: task
priority: normal
created_at: 2026-11-06T00:15:50Z
updated_at: 2026-11-06T00:37:42Z
---

Bring the repo's rules and workflow security to the chosen parts of the template standard. Merge method stays squash only. Approvals drop to 0 with no bypass, main requires signed commits, required checks tie to app IDs and stay strict, and CodeQL jobs become required. SHA pinning is enforced by repo setting, workflow tokens are narrowed, and only Renovate opens dependency PRs.

## Summary of Changes

Every workflow starts from empty token permissions with per-job grants, and every checkout sets persist-credentials to false. Native build tooling moved from a global install to a root devDependency, so CI no longer installs an unlocked package.

New repo checks run on every PR: gitleaks, zizmor, actionlint, typos, markdownlint, and commit format through commitlint. scripts/check-repo.sh runs the same steps locally. OpenSSF Scorecard runs as an informational workflow.

Crowdin translation commits now go through the GraphQL createCommitOnBranch mutation, which is what makes them signed when an App token writes them. The Crowdin action only downloads, and scripts/crowdin/commit-translations.ts commits the changed files.

Renovate signs its commits through platformCommit and tracks the checksummed tool downloads. Findings from the new checks are fixed in the docs and code.
