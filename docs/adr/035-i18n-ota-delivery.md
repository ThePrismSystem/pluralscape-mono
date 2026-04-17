# ADR 035: i18n OTA Delivery via API Proxy

## Status

Accepted

## Context

Pluralscape ships 12 locales. Baseline translations live in the repo and are bundled per build. Translators correct strings in Crowdin. The product requirement is that translation fixes reach users without an app release, while preserving offline-first behavior and user anonymity.

Directly fetching translations from Crowdin's Distribution CDN from each device would expose end-user IPs, locale tags, and launch-time metadata to a third party. That conflicts with Pluralscape's privacy posture: the server is designed to be zero-knowledge, and the app avoids leaking analytics to external services by default.

At the same time, ship-only bundled translations force a full app release for every translation fix — unacceptable for a 12-locale target where translators iterate continuously in Crowdin.

## Decision

Mobile uses `i18next-chained-backend` composed of two layers:

1. A bundled-resources layer reading repo JSON via dynamic `import()`. Metro code-splits per locale, so only the active locale is parsed at runtime.
2. An HTTP layer targeting `/v1/i18n/:locale/:namespace` on the Pluralscape API.

The API proxies Crowdin Distribution (CDN), caching responses in Valkey with a 24h TTL and serving ETag-gated 304s. Mobile caches OTA responses in AsyncStorage with a 7-day freshness window; stale or failed fetches fall back to the bundled baseline.

A new rate-limit category `i18nFetch` (30/min/IP) caps unauthenticated hits on the public proxy endpoints.

### Rationale

- Crowdin never sees end-user IPs — only the Pluralscape API's server IPs.
- The bundled baseline guarantees the app works on cold start and when offline, preserving offline-first.
- The 7-day mobile cache plus 24h server cache keeps both CDN egress and device data usage low.
- ETag-gated 304s make OTA refresh cheap on warm caches.

## Alternatives

1. **Direct Crowdin CDN from device.** Rejected: every app launch would leak user IP, locale, and launch-time metadata to a third party, conflicting with Pluralscape's privacy posture.
2. **Bundled-only, no OTA.** Rejected: the explicit product goal is to fix translations without an app release.
3. **OTA-only (no bundled baseline).** Rejected: violates offline-first. A cold cache plus no network means a blank UI.
4. **Crowdin webhook → instant cache invalidation.** Deferred. The 24h TTL is acceptable; an admin-only invalidation endpoint covers urgent cases.

## Consequences

- Crowdin never sees end-user IPs. The proxy pays nominal bandwidth cost.
- API bundle grows by approximately 300 lines (route, service, cache adapter, tRPC mirror).
- Mobile bundle grows by approximately 220KB of translation JSON across 12 locales; only the active locale is parsed at runtime thanks to code-splitting.
- Failure modes are contained: OTA failure → stale cache → bundled baseline. Offline → bundled baseline.
- Rate-limit category `i18nFetch` provides anti-scrape without blocking legitimate cold-start bursts.
- Translator fixes roll out on a best-case same-day cadence (bounded by the 24h server TTL) without app releases.
