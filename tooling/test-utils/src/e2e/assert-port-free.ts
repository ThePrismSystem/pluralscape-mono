/**
 * Assert that a TCP port on 127.0.0.1 is free by briefly binding to it.
 *
 * Used by E2E bootstrap to refuse to proceed when a stray API server from
 * a prior crashed run is still listening on the test port — otherwise
 * the health-poll loop silently attaches to the zombie.
 *
 * TOCTOU: there is a small window between this probe closing and the
 * real server spawning in which a third party could claim the port.
 * Acceptable for test infra on a single host; the spawned child's
 * own EADDRINUSE would still be surfaced through the widened stderr
 * forwarding in the caller.
 */
import net from "node:net";

export function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${String(port)} is already in use — a stray API server from a prior run is likely squatting.\n` +
              `Find and kill it:\n` +
              `  lsof -iTCP:${String(port)} -sTCP:LISTEN -nP\n` +
              `  kill <pid>`,
          ),
        );
        return;
      }
      reject(err);
    });
    probe.once("listening", () => {
      probe.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
        } else {
          resolve();
        }
      });
    });
    probe.listen(port, "127.0.0.1");
  });
}
