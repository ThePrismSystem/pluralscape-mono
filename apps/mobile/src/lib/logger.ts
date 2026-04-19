import { createMobileLogger } from "@pluralscape/logger/mobile";

import type { Logger } from "@pluralscape/logger";

/**
 * Module-level singleton logger for the mobile app. Import where needed:
 *
 *   import { logger } from "../lib/logger";
 *   logger.info("hydrated", { memberCount });
 *
 * Consistent with `apps/api/src/lib/logger.ts` — shared package, shared
 * `Logger` interface, platform-specific factory. Replace `console.*` call
 * sites with this singleton.
 */
export const logger: Logger = createMobileLogger();
