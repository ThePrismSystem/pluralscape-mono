import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { startHarnessServer } from "./harness/serve.js";

import type { Server } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));

interface HarnessGlobals {
  __harnessServer?: Server;
}

export default async function globalSetup(): Promise<void> {
  const dist = resolve(here, "../dist");
  mkdirSync(dist, { recursive: true });

  // Bundle controller.ts + opfs-worker.ts (referenced via `new Worker(new URL(...))`).
  // esbuild handles the worker URL when `bundle: true`. The wa-sqlite `.wasm`
  // payload is loaded at runtime by the Emscripten module factory; we copy it
  // alongside via the `file` loader so it ships in `dist/`.
  await build({
    entryPoints: [resolve(here, "harness/controller.ts")],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: resolve(dist, "controller.js"),
    loader: { ".wasm": "file" },
  });

  cpSync(resolve(here, "harness/index.html"), resolve(dist, "index.html"));

  const { server } = await startHarnessServer();
  const globals = globalThis as typeof globalThis & HarnessGlobals;
  globals.__harnessServer = server;
}
