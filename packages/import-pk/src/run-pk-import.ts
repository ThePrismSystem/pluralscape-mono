import { runImportEngine } from "@pluralscape/import-core";

import { PK_DEPENDENCY_ORDER } from "./engine/dependency-order.js";
import { pkCollectionToEntityType } from "./engine/entity-type-map.js";
import { classifyPkError } from "./engine/error-classifier.js";
import { PK_MAPPER_DISPATCH } from "./engine/mapper-dispatch.js";

import type { ImportDataSource, ImportRunResult, Persister } from "@pluralscape/import-core";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionType,
} from "@pluralscape/types";

export interface RunPkImportArgs {
  readonly source: ImportDataSource;
  readonly persister: Persister;
  readonly options: {
    readonly selectedCategories: Partial<Record<ImportCollectionType, boolean>>;
    readonly avatarMode: ImportAvatarMode;
  };
  readonly initialCheckpoint?: ImportCheckpointState;
  readonly onProgress: (state: ImportCheckpointState) => Promise<void>;
  readonly abortSignal?: AbortSignal;
}

export async function runPkImport(args: RunPkImportArgs): Promise<ImportRunResult> {
  return runImportEngine({
    source: args.source,
    persister: args.persister,
    sourceFormat: "pluralkit",
    mapperDispatch: PK_MAPPER_DISPATCH,
    dependencyOrder: PK_DEPENDENCY_ORDER,
    collectionToEntityType: pkCollectionToEntityType,
    classifyError: classifyPkError,
    options: args.options,
    initialCheckpoint: args.initialCheckpoint,
    onProgress: args.onProgress,
    abortSignal: args.abortSignal,
  });
}
