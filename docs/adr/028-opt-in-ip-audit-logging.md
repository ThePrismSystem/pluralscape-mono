# ADR 028: Opt-in IP Address and User-Agent Audit Logging

## Status

Accepted

## Context

The `audit_log` table stores IP addresses and user-agent strings on every request. While useful for security forensics, this conflicts with Pluralscape's core privacy posture: "No telemetry without opt-in" (VALUES.md). The existing 90-day retention policy (ADR 017) mitigates accumulation but does not address the consent issue.

Rate limiting uses IP addresses ephemerally as Valkey/memory bucket keys and never persists them. This is not affected.

## Decision

Add an `audit_log_ip_tracking` boolean column to the `accounts` table, default `false`. When the setting is off, the audit writer sets `ip_address` and `user_agent` to null before inserting.

The setting is carried on `AuthContext`, populated during session validation (which already JOINs to the accounts table). No additional database query per request.

For unauthenticated routes (register, login, password-reset), no auth context exists, so IP/UA is never logged. This is the correct default — the user has not yet consented (or does not yet have an account to store the preference). This means login audit entries are always IP-free, even for opted-in accounts.

Enabling the setting requires a `PUT /account/settings` request. A future client-side implementation will surface a confirmation dialog and email verification before toggling this on, to prevent accidental enablement.

### Audit log entry for the setting change itself

The audit entry written when toggling `audit_log_ip_tracking` uses the _new_ tracking state via `overrideTrackIp` on `AuditWriteParams`, not the stale auth context captured at request start:

- **Enabling**: the "settings.changed" entry includes IP/UA (the user just consented)
- **Disabling**: the "settings.changed" entry excludes IP/UA (consent was just revoked)

## Consequences

**Positive:**

- Aligns with "No telemetry without opt-in" core value
- Default-off means no GDPR consent burden for new accounts
- Zero performance cost (piggybacked on existing auth query)
- Unauthenticated routes automatically excluded

**Negative:**

- Forensic analysis of security incidents loses IP/UA data for accounts that have not opted in (accepted trade-off for a privacy-first application)
- Client-side UI and email confirmation flow deferred to a separate work item
