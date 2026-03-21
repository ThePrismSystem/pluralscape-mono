---
# db-jpjm
title: Second-pass zero-knowledge hardening for member-identifying columns
status: draft
type: feature
priority: deferred
created_at: 2026-03-11T22:32:15Z
updated_at: 2026-03-21T10:13:23Z
parent: ps-6itw
---

Additional plaintext columns that leak member identity, flagged during db-bbzk review:

- notes.memberId — leaks note authorship
- acknowledgements.createdByMemberId — leaks who created acknowledgement requests
- polls.createdByMemberId — leaks poll creator identity
- poll_votes.voter / poll_votes.optionId — leaks voting patterns

These are the same class of ZK violation as db-fymu (senderId) but were not in the original audit findings H5-H9. Scope separately from db-bbzk.
