import { secureHeaders as honoSecureHeaders } from "hono/secure-headers";

/**
 * Security headers middleware. Wraps Hono's built-in secureHeaders()
 * with project-specific CSP and framing policies.
 */
export const secureHeaders = honoSecureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    frameAncestors: ["'none'"],
  },
  xFrameOptions: "DENY",
  strictTransportSecurity: "max-age=63072000; includeSubDomains",
});
