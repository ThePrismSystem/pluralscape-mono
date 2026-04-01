const DAYS_MS = 24 * 60 * 60 * 1000;

const MOBILE_ABSOLUTE_DAYS = 90;
const MOBILE_IDLE_DAYS = 30;
const WEB_ABSOLUTE_DAYS = 30;
const WEB_IDLE_DAYS = 7;
const REFRESH_RATIO = 0.8;

const PLATFORM_TIMEOUTS = {
  mobile: {
    absoluteMs: MOBILE_ABSOLUTE_DAYS * DAYS_MS,
    idleMs: MOBILE_IDLE_DAYS * DAYS_MS,
  },
  web: {
    absoluteMs: WEB_ABSOLUTE_DAYS * DAYS_MS,
    idleMs: WEB_IDLE_DAYS * DAYS_MS,
  },
} as const;

export class SessionRefreshService {
  private readonly timeouts: { absoluteMs: number; idleMs: number };

  constructor(config: { platform: "web" | "mobile" }) {
    this.timeouts = PLATFORM_TIMEOUTS[config.platform];
  }

  nextRefreshDelayMs(): number {
    return Math.floor(this.timeouts.idleMs * REFRESH_RATIO);
  }

  get absoluteTtlMs(): number {
    return this.timeouts.absoluteMs;
  }

  get idleTimeoutMs(): number {
    return this.timeouts.idleMs;
  }
}
