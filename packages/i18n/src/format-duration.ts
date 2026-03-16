import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from "./time-constants.js";

interface DurationParts {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

function decompose(ms: number): DurationParts {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / MS_PER_DAY);
  const hours = Math.floor((abs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((abs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((abs % MS_PER_MINUTE) / MS_PER_SECOND);
  return { days, hours, minutes, seconds };
}

/**
 * Formats a duration in milliseconds as a human-readable string.
 *
 * @param style - "short" produces "2h 15m", "narrow" produces "2h15m"
 */
export function formatDuration(ms: number, style: "short" | "narrow" = "short"): string {
  if (ms === 0) {
    return formatUnitValue(0, "second");
  }

  const { days, hours, minutes, seconds } = decompose(ms);
  const separator = style === "narrow" ? "" : " ";
  const parts: string[] = [];

  if (days > 0) {
    parts.push(formatUnitValue(days, "day"));
  }
  if (hours > 0) {
    parts.push(formatUnitValue(hours, "hour"));
  }
  if (minutes > 0) {
    parts.push(formatUnitValue(minutes, "minute"));
  }
  if (seconds > 0 && days === 0) {
    parts.push(formatUnitValue(seconds, "second"));
  }

  return parts.join(separator);
}

type DurationUnit = "day" | "hour" | "minute" | "second";

const SHORT_LABELS: Record<DurationUnit, string> = {
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

function formatUnitValue(value: number, unit: DurationUnit): string {
  const label = SHORT_LABELS[unit];
  return `${String(value)}${label}`;
}

/**
 * Formats a fronting session duration.
 *
 * @param startMs - Start timestamp in milliseconds
 * @param endMs - End timestamp in milliseconds, or null for ongoing fronts
 * @param now - Current time in milliseconds (for ongoing fronts)
 */
export function formatFrontingDuration(
  startMs: number,
  endMs: number | null,
  now?: number,
): string {
  const end = endMs ?? now ?? Date.now();
  const durationMs = Math.max(0, end - startMs);
  return formatDuration(durationMs);
}
