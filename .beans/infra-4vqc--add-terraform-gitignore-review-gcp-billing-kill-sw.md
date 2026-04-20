---
# infra-4vqc
title: Add terraform .gitignore + review GCP billing kill-switch README
status: completed
type: task
priority: normal
created_at: 2026-04-19T21:32:09Z
updated_at: 2026-04-19T21:34:28Z
---

User added scripts/infra/gcp-billing-kill-switch/ — a terraform module that detaches GCP billing if month-to-date spend exceeds threshold (default $1, used to keep Crowdin → Google Translate within free tier). Tasks: review the README, add appropriate .gitignore entries for terraform (root + local), propose README improvements, push to a new branch.

## Summary of Changes

**Root .gitignore** — added repo-wide Terraform section: `**/.terraform/`, state/plan files, tfvars (with `!*.tfvars.example`), override files, terraformrc, crash logs.

**Local .gitignore** (`scripts/infra/gcp-billing-kill-switch/.gitignore`) — slimmed to module-specific patterns: `terraform/.build/` (zip output dir from `function.tf`), terraform override files, python dev artifacts. Removed redundant patterns now covered by root.

**README improvements**:

- Latency caveat callout under "How it works" — emphasizes multi-hour budget eval cadence (soft cap, not instant).
- New "What this creates" inventory section listing every resource Terraform stands up.
- New "Cost" section noting the kill switch itself fits in GCP free tier.
- Added `gcloud config set project` to deploy step 1 so later commands don't need `--project`.
- Step 4 now points to step 5 for email verification (verification email arrives during first apply).
- Filled in the previously empty "End-to-end test (optional, destructive)" section with concrete steps + recommendation to skip.
- Recovery section gained a re-trigger-risk callout: re-linking billing while month-to-date spend > threshold will fire again within hours.

**Verified**: `git ls-files --others --exclude-standard scripts/infra/` shows clean output — `.terraform.lock.hcl` and `terraform.tfvars.example` will be committed (correct), no state/real tfvars/.build/ leak.
