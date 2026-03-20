import { env } from "../env.js";
import {
  CLIENT_PLATFORM_HEADER,
  DEFAULT_PLATFORM,
  VALID_PLATFORMS,
} from "../routes/auth/auth.constants.js";

import { isValidIpFormat } from "./ip-validation.js";

import type { ClientPlatform } from "../routes/auth/auth.constants.js";
import type { Context } from "hono";

export interface RequestMeta {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/** Extract IP address from request context. */
export function extractIpAddress(c: Context): string | null {
  if (env.TRUST_PROXY) {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip && isValidIpFormat(ip)) return ip;
  }
  return null;
}

/** Extract user agent from request context. */
export function extractUserAgent(c: Context): string | null {
  return c.req.header("user-agent") ?? null;
}

/** Extract both IP address and user agent as a RequestMeta object. */
export function extractRequestMeta(c: Context): RequestMeta {
  return {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };
}

/** Type guard for valid client platform values. */
function isClientPlatform(value: string): value is ClientPlatform {
  return (VALID_PLATFORMS as readonly string[]).includes(value);
}

/** Determine the client platform for session TTL selection. */
export function extractPlatform(c: Context): ClientPlatform {
  const header = c.req.header(CLIENT_PLATFORM_HEADER);
  if (header && isClientPlatform(header)) {
    return header;
  }
  return DEFAULT_PLATFORM;
}
