# ADR 021: Non-System Account Model

## Status

Accepted

## Context

Pluralscape needs to support non-system users (therapists, supportive friends) who want to view system data via privacy buckets but don't have a system of their own. Previously, all friend connections were system-to-system (`systemId` <-> `friendSystemId`). This required non-system users to create a dummy system entity, which is semantically wrong and confusing. The friend network, privacy bucket sharing, and key grants all used `systemId` as the connection anchor.

## Decision

- Add an `accountType` field to accounts: `"system"` (default) or `"viewer"`
- Viewer accounts have no System entity — they are truly system-less
- Move friend connections to account-level: `accountId`/`friendAccountId` instead of `systemId`/`friendSystemId`
- Move friend codes to account-level: `accountId` instead of `systemId`
- Move key grants to account-level: `friendAccountId` instead of `friendSystemId`
- Privacy bucket content tags still reference `systemId` — they tag content within a system, which is correct
- PrivacyBucket itself still belongs to a system (`buckets.systemId`) — buckets organize system content
- Viewer accounts can receive key grants and decrypt bucket-scoped data without owning a system
- Settings for viewer accounts: account-level settings or stored in encrypted account data (no system = no SystemSettings)

## Consequences

- Friend-related tables (`friend_connections`, `friend_codes`, `key_grants`) now reference accounts instead of systems
- RLS policies for friend tables need updating to use `account_id`
- Notification routing for friend switch alerts needs account-level lookup
- Non-system accounts cannot create fronting sessions, members, or any system-owned data
- System-to-system friend connections still work (both accounts happen to be type `"system"`)
- Migration required for existing data: rename columns, update constraints and indexes
- API endpoints that accept friend operations need to use `accountId` context
