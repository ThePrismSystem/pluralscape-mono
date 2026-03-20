/**
 * Anti-enumeration timing equalization.
 *
 * Ensures auth endpoints respond in consistent time regardless of whether
 * the targeted account exists. Uses a minimum response floor combined with
 * dummy cryptographic work on the not-found path.
 */
import { ANTI_ENUM_TARGET_MS } from "../routes/auth/auth.constants.js";

/**
 * Sleep for the remainder of the anti-enumeration timing window.
 * Call this at the end of not-found branches to equalize response time
 * with the real-account path.
 */
export async function equalizeAntiEnumTiming(startTime: number): Promise<void> {
  const elapsed = performance.now() - startTime;
  const remaining = ANTI_ENUM_TARGET_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}
