import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { startHarnessServer } from "./harness/serve.js";

import type { Server } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));

interface HarnessGlobals {
  __harnessServer?: Server;
}

/**
 * Resolve the on-disk path of a wa-sqlite asset using `createRequire`. We have
 * to walk pnpm's `.pnpm/...` layout, and `require.resolve` already handles that
 * correctly via the project's package manifest.
 */
function resolveWaSqliteAsset(filename: string): string {
  const requireFromHere = createRequire(import.meta.url);
  // package.json sits at the wa-sqlite root; strip it and append the asset path.
  const pkgJson = requireFromHere.resolve("@journeyapps/wa-sqlite/package.json");
  return resolve(dirname(pkgJson), "dist", filename);
}

export default async function globalSetup(): Promise<void> {
  const dist = resolve(here, "../dist");
  mkdirSync(dist, { recursive: true });

  // Bundle the worker first so we can reference its built path from the
  // controller. esbuild does NOT recognize the `new Worker(new URL(...))`
  // pattern as a build-time worker entry, so we wire it up manually:
  //   1. Build opfs-worker.ts -> dist/opfs-worker.js (its own ESM bundle)
  //   2. Build controller.ts -> dist/controller.js
  //   3. Rewrite the literal `./opfs-worker.ts` reference in controller.js to
  //      point at the built `./opfs-worker.js` so the browser fetches a real
  //      file at runtime.
  const workerEntry = resolve(here, "../../mobile/src/platform/drivers/opfs-worker.ts");
  await build({
    entryPoints: [workerEntry],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: resolve(dist, "opfs-worker.js"),
    loader: { ".wasm": "file" },
  });

  await build({
    entryPoints: [resolve(here, "harness/controller.ts")],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: resolve(dist, "controller.js"),
    loader: { ".wasm": "file" },
  });

  // Patch the inline `new Worker(new URL("./opfs-worker.ts", ...))` reference.
  // esbuild leaves the literal string unchanged when bundling; we swap the
  // extension so the harness server can serve it. Assert exactly one match —
  // an unintended hit (a comment, a log line, an unrelated file with the same
  // string) would silently corrupt the bundle.
  const controllerPath = resolve(dist, "controller.js");
  const controllerSrc = readFileSync(controllerPath, "utf8");
  const workerRefPattern = /"\.\/opfs-worker\.ts"/g;
  const matches = controllerSrc.match(workerRefPattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `global-setup: expected exactly 1 occurrence of "./opfs-worker.ts" in bundled ` +
        `controller.js, found ${String(matches.length)}. The string-patch step is no ` +
        `longer safe — investigate whether esbuild now bundles workers natively, or ` +
        `narrow the pattern.`,
    );
  }
  writeFileSync(controllerPath, controllerSrc.replace(workerRefPattern, '"./opfs-worker.js"'));

  // wa-sqlite ships its WASM payload as a sibling of `wa-sqlite.mjs`. The
  // Emscripten `locateFile` resolves relative to the importer's `import.meta.url`,
  // which after bundling becomes the worker bundle. Copy the wasm next to the
  // worker so the runtime fetch resolves correctly.
  //
  // NOTE: wa-sqlite ships several variants (wa-sqlite-async.wasm, wa-sqlite-jspi,
  // mc-wa-sqlite, libpowersync-async, etc.). Only `wa-sqlite.wasm` is copied
  // because the worker imports `dist/wa-sqlite.mjs`. If `opfs-worker.ts` ever
  // switches to the async or jspi build (likely needed for full OPFS sync access
  // in some browsers), add the matching wasm file here.
  cpSync(resolveWaSqliteAsset("wa-sqlite.wasm"), resolve(dist, "wa-sqlite.wasm"));

  cpSync(resolve(here, "harness/index.html"), resolve(dist, "index.html"));

  const { server } = await startHarnessServer();
  const globals = globalThis as typeof globalThis & HarnessGlobals;
  globals.__harnessServer = server;
}
