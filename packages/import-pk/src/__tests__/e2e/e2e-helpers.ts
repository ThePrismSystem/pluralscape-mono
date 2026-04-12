/**
 * E2E test helpers for import-pk.
 *
 * Provides fixture file resolution and a convenience wrapper that runs the
 * full PK import pipeline against a JSON export file using an in-memory
 * persister. Unlike import-sp E2E tests, these need no running server --
 * the in-memory persister validates the full pipeline from file parsing
 * through mapping to entity persistence.
 */
import path from "node:path";

import { createInMemoryPersister } from "@pluralscape/import-core/testing";

import { runPkImport } from "../../run-pk-import.js";
import { createPkFileImportSource } from "../../sources/pk-file-source.js";

import type { ImportRunResult } from "@pluralscape/import-core";
import type { InMemoryPersisterSnapshot } from "@pluralscape/import-core/testing";

/** Resolved path to the fixtures directory. */
export const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");

/** Build an absolute path to a fixture file. */
export function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename);
}

/** No-op progress callback for tests that do not need progress tracking. */
function noopProgress(): Promise<void> {
  return Promise.resolve();
}

/** Result returned by {@link runFileImport}. */
export interface FileImportResult {
  readonly result: ImportRunResult;
  readonly snapshot: InMemoryPersisterSnapshot;
}

/**
 * Run a full PK import from a JSON export file.
 *
 * Creates the file source and in-memory persister, runs the engine, and
 * returns both the run result and a snapshot of persisted entities.
 */
export async function runFileImport(filePath: string): Promise<FileImportResult> {
  const source = createPkFileImportSource({ filePath });
  const { persister, snapshot } = createInMemoryPersister();

  const result = await runPkImport({
    source,
    persister,
    options: { selectedCategories: {}, avatarMode: "skip" },
    onProgress: noopProgress,
  });

  return { result, snapshot: snapshot() };
}
