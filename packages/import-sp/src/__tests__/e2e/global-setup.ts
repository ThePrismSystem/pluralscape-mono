/**
 * Vitest global setup for import-sp E2E tests.
 *
 * Delegates to the shared E2E setup factory in @pluralscape/test-utils.
 */
import { createE2EGlobalSetup } from "@pluralscape/test-utils/e2e";

const PREFIX = "[import-sp-e2e]";

export default createE2EGlobalSetup({
  log: (msg) => {
    console.info(`${PREFIX} ${msg}`);
  },
  warn: (msg) => {
    console.warn(`${PREFIX} ${msg}`);
  },
});
