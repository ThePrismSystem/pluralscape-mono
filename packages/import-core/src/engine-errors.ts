import type { ImportError, ImportEntityType } from "@pluralscape/types";

export interface ClassifyContext {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
}

export class ResumeCutoffNotFoundError extends Error {
  public readonly collection: string;
  public readonly cutoffId: string;
  public constructor(collection: string, cutoffId: string) {
    super(`Resume cutoff ${cutoffId} not found in collection ${collection}`);
    this.name = "ResumeCutoffNotFoundError";
    this.collection = collection;
    this.cutoffId = cutoffId;
  }
}

export type ErrorClassifier = (thrown: unknown, ctx: ClassifyContext) => ImportError;

export function classifyErrorDefault(thrown: unknown, ctx: ClassifyContext): ImportError {
  if (thrown instanceof ResumeCutoffNotFoundError) {
    return {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      message: thrown.message,
      fatal: true,
      recoverable: true,
    };
  }
  if (thrown instanceof SyntaxError) {
    return {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      message: thrown.message,
      fatal: true,
      recoverable: false,
    };
  }
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  return {
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    message,
    fatal: false,
  };
}

export function isFatalError(error: ImportError): boolean {
  return error.fatal;
}
