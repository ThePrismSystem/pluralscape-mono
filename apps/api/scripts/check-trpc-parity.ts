/**
 * tRPC ↔ REST Parity Check — Entry Point
 *
 * Thin wrapper that imports from trpc-parity-lib.ts and runs the check.
 * All logic lives in the library module for testability.
 *
 * Run from monorepo root: pnpm trpc:parity
 * Run from apps/api: npx tsx scripts/check-trpc-parity.ts
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRESTInventory,
  discoverTRPCProcedures,
  extractTRPCRateLimits,
  extractTRPCScopes,
  printResults,
  runParityChecks,
} from "./trpc-parity-lib.js";

async function main(): Promise<void> {
  let trpcProcedures = await discoverTRPCProcedures();
  trpcProcedures = extractTRPCRateLimits(trpcProcedures);
  trpcProcedures = extractTRPCScopes(trpcProcedures);
  const { routes: restRoutes, failures: discoveryFailures } = buildRESTInventory();
  const { failures, warnings, stats } = runParityChecks(restRoutes, trpcProcedures);
  const allFailures = [...discoveryFailures, ...failures];
  printResults(allFailures, warnings, stats);
  if (allFailures.length > 0) {
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const isMain = __filename === resolve(process.argv[1] ?? "");

if (isMain) {
  main().catch((err: unknown) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export { main };
