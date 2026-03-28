---
# db-jpjm
title: Second-pass zero-knowledge hardening for member-identifying columns
status: scrapped
type: feature
priority: deferred
created_at: 2026-03-11T22:32:15Z
updated_at: 2026-03-28T20:49:49Z
parent: ps-6itw
---

Additional plaintext columns that leak member identity, flagged during db-bbzk review:

- notes.memberId — leaks note authorship
- acknowledgements.createdByMemberId — leaks who created acknowledgement requests
- polls.createdByMemberId — leaks poll creator identity
- poll_votes.voter / poll_votes.optionId — leaks voting patterns

These are the same class of ZK violation as db-fymu (senderId) but were not in the original audit findings H5-H9. Scope separately from db-bbzk.

## Reasons for Scrapping

These columns are necessary for application functionality and are already protected by RLS policies that restrict access to the owning system. The server-side encryption model (T1/T2/T3 tiers) handles sensitive data at rest, and these foreign key references don't expose meaningful information beyond what the authenticated system owner already has access to. The zero-knowledge boundary is maintained at the network/API layer, not at the column level for internal relational references.
