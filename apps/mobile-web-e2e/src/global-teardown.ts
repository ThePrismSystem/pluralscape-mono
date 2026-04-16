import type { Server } from "node:http";

interface HarnessGlobals {
  __harnessServer?: Server;
}

export default async function globalTeardown(): Promise<void> {
  const globals = globalThis as typeof globalThis & HarnessGlobals;
  const server = globals.__harnessServer;
  if (server === undefined) return;
  await new Promise<void>((resolvePromise) => {
    server.close(() => {
      resolvePromise();
    });
  });
}
