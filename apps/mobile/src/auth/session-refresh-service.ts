const DAYS_MS = 24 * 60 * 60 * 1_000;

const MOBILE_ABSOLUTE_DAYS = 90;
const MOBILE_IDLE_DAYS = 30;
const WEB_ABSOLUTE_DAYS = 30;
const WEB_IDLE_DAYS = 7;
const REFRESH_RATIO = 0.8;

const PLATFORM_TIMEOUTS = {
  mobile: {
    absoluteTtlMs: MOBILE_ABSOLUTE_DAYS * DAYS_MS,
    idleTimeoutMs: MOBILE_IDLE_DAYS * DAYS_MS,
  },
  web: {
    absoluteTtlMs: WEB_ABSOLUTE_DAYS * DAYS_MS,
    idleTimeoutMs: WEB_IDLE_DAYS * DAYS_MS,
  },
} as const;

export interface SessionTimeouts {
  readonly absoluteTtlMs: number;
  readonly idleTimeoutMs: number;
  readonly nextRefreshDelayMs: number;
}

export function getSessionTimeouts(platform: "web" | "mobile"): SessionTimeouts {
  const { absoluteTtlMs, idleTimeoutMs } = PLATFORM_TIMEOUTS[platform];
  return {
    absoluteTtlMs,
    idleTimeoutMs,
    nextRefreshDelayMs: Math.floor(idleTimeoutMs * REFRESH_RATIO),
  };
}
