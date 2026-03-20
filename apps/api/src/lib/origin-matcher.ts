/**
 * Shared origin matching for CORS and WebSocket origin validation.
 *
 * Supports exact matches and wildcard patterns (e.g., `*.example.com`).
 * Wildcard patterns match any subdomain but NOT the bare domain itself,
 * preventing suffix-injection attacks.
 */

/**
 * Check whether an origin is allowed by a list of patterns.
 *
 * Pattern types:
 * - Exact: `https://app.example.com` — matches that origin only
 * - Wildcard: `*.example.com` — matches `https://sub.example.com`,
 *   `http://deep.sub.example.com`, etc. Does NOT match `https://example.com`
 *   or `https://evilexample.com`.
 */
export function isOriginAllowed(origin: string, allowlist: readonly string[]): boolean {
  for (const pattern of allowlist) {
    if (pattern.startsWith("*.")) {
      if (matchesWildcard(origin, pattern)) return true;
    } else if (origin === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Match a wildcard pattern like `*.example.com` against an origin URL.
 *
 * Extracts the hostname from the origin, then checks that the hostname
 * ends with `.example.com` (dot-prefixed to prevent suffix injection).
 * The bare domain `example.com` does not match — only subdomains.
 */
function matchesWildcard(origin: string, pattern: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  // pattern is `*.example.com` → domain suffix is `example.com`
  const domainSuffix = pattern.slice(2); // remove `*.`
  // hostname must end with `.example.com` (dot-prefixed prevents suffix injection)
  return hostname.endsWith("." + domainSuffix);
}
