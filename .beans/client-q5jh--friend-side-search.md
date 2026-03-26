---
# client-q5jh
title: Friend-side search
status: todo
type: epic
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-26T16:06:37Z
parent: ps-6itw
blocked_by:
  - client-napj
---

Paginated friend data export endpoint for client-side search. Friend's client pulls all bucket-permitted encrypted data locally, builds FTS5 index, searches client-side. Includes data freshness headers for conditional requests.

### Scope (4 features)

- [ ] 5.1 Paginated friend data export endpoint
- [ ] 5.2 Data freshness headers
- [ ] 5.3 Friend search types
- [ ] 5.4 Friend data E2E tests + OpenAPI
