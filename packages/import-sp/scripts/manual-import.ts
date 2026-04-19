/**
 * Manual smoke-test for the SP import engine.
 *
 * Runs `runImport` against a real SP JSON export on disk with a printing-only
 * persister, so a developer can eyeball the engine's behaviour end-to-end
 * without wiring up real persistence or a database.
 *
 * Usage:
 *   pnpm --filter @pluralscape/import-sp smoke-test <path/to/export.json>
 *   # or
 *   tsx packages/import-sp/scripts/manual-import.ts <path/to/export.json>
 *
 * Exits 0 on "completed" outcome, 1 on "aborted" (or any thrown error).
 *
 * Not part of CI — this script is intentionally not wired into the test
 * pipeline. It exists so developers can smoke-test real SP exports locally
 * before committing changes to the engine or mappers.
 */
import { readFileSync } from "node:fs";
import process from "node:process";

import { emptyCheckpointState } from "@pluralscape/import-core";

import { collectionToEntityType } from "../src/engine/entity-type-map.js";
import { runImport } from "../src/engine/import-engine.js";
import { createFileImportSource } from "../src/sources/file-source.js";

import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../src/persistence/persister.types.js";
import type { ImportError } from "@pluralscape/types";

const EXIT_OK = 0;
const EXIT_FAILURE = 1;

function createPrintingPersister(): Persister {
  let counter = 0;
  return {
    upsertEntity(entity: PersistableEntity): Promise<PersisterUpsertResult> {
      counter += 1;
      const pluralscapeEntityId = `dev_${String(counter)}`;
      console.log(`UPSERT ${entity.entityType} ${entity.sourceEntityId} -> ${pluralscapeEntityId}`);
      return Promise.resolve({ action: "created", pluralscapeEntityId });
    },
    recordError(error: ImportError): Promise<void> {
      console.log(`ERROR  ${error.entityType} ${error.entityId ?? "(no id)"}: ${error.message}`);
      return Promise.resolve();
    },
    flush(): Promise<void> {
      console.log("FLUSH");
      return Promise.resolve();
    },
  };
}

async function main(): Promise<number> {
  const exportPath = process.argv[2];
  if (!exportPath) {
    console.error("Usage: smoke-test <path/to/sp-export.json>");
    return EXIT_FAILURE;
  }

  const bytes = new Uint8Array(readFileSync(exportPath));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const source = createFileImportSource({ stream });
  const persister = createPrintingPersister();

  const result = await runImport({
    source,
    persister,
    initialCheckpoint: emptyCheckpointState({
      firstEntityType: collectionToEntityType("users"),
      selectedCategories: {},
      avatarMode: "skip",
    }),
    options: { selectedCategories: {}, avatarMode: "skip" },
    onProgress: () => Promise.resolve(),
  });
  await source.close();

  console.log("\n=== Summary ===");
  console.log(`Outcome:  ${result.outcome}`);
  console.log(`Warnings: ${String(result.warnings.length)}`);
  console.log(`Errors:   ${String(result.errors.length)}`);
  console.log("Totals by entity type:");
  console.log(JSON.stringify(result.finalState.totals.perCollection, null, 2));

  return result.outcome === "completed" ? EXIT_OK : EXIT_FAILURE;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(EXIT_FAILURE);
  });
