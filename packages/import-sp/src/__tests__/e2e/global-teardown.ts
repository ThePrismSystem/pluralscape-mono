/**
 * Vitest global teardown for import-sp E2E tests.
 *
 * Kills the API server and removes Docker containers started by global-setup.
 */
import { killServer } from "@pluralscape/test-utils/e2e";

const PREFIX = "[import-sp-e2e]";

function globalTeardown(): void {
  const pid = process.env["E2E_SERVER_PID"];
  killServer(pid ? Number(pid) : undefined, {
    startedPgContainer: process.env["E2E_STARTED_CONTAINER"] === "1",
    startedMinio: process.env["E2E_STARTED_MINIO"] === "1",
    log: (msg) => {
      console.info(`${PREFIX} ${msg}`);
    },
  });
}

export default globalTeardown;
