import { KEY_ROTATION } from "@pluralscape/types";

import { processChunk } from "./chunk-processor.js";

const HTTP_NOT_FOUND = 404;

import type { RotationProgressCallback, RotationWorkerConfig } from "./types.js";

/**
 * Client-side rotation worker that claims chunks from the rotation API,
 * re-encrypts items, and reports completion.
 *
 * Designed to be platform-agnostic — the app provides an API client adapter.
 */
export class RotationWorker {
  private abortController: AbortController | null = null;
  private running = false;

  private readonly config: RotationWorkerConfig;
  private readonly onProgress?: RotationProgressCallback;

  constructor(config: RotationWorkerConfig, onProgress?: RotationProgressCallback) {
    this.config = config;
    this.onProgress = onProgress;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the rotation loop. Claims chunks, processes them, reports completion.
   * Resolves when all items are processed or the worker is stopped.
   */
  async start(): Promise<void> {
    if (this.running) return;

    this.abortController = new AbortController();
    this.running = true;
    const { signal } = this.abortController;

    const {
      apiClient,
      bucketId,
      rotationId,
      oldKey,
      oldKeyVersion,
      newKey,
      newKeyVersion,
      chunkSize = KEY_ROTATION.defaultChunkSize,
    } = this.config;

    try {
      while (!signal.aborted) {
        // Claim a chunk
        const claim = await apiClient.claimChunk(bucketId, rotationId, chunkSize);

        // No items left to process
        if (claim.data.length === 0) {
          break;
        }

        // Process each item in the chunk
        const results = await processChunk(
          claim.data,
          apiClient,
          oldKey,
          oldKeyVersion,
          newKey,
          newKeyVersion,
          signal,
        );

        // Report completion
        const completion = await apiClient.completeChunk(bucketId, rotationId, results);

        // Notify progress
        this.onProgress?.(completion.rotation);

        // If the rotation transitioned to completed/failed, stop
        if (completion.rotation.state === "completed" || completion.rotation.state === "failed") {
          break;
        }
      }
    } catch (error) {
      // On rotation-level 404: rotation was deleted/cancelled, stop gracefully
      if (isHttpError(error, HTTP_NOT_FOUND)) {
        return;
      }
      throw error;
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  /** Stop the rotation worker gracefully. */
  stop(): void {
    this.abortController?.abort();
  }
}

function isHttpError(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === status
  );
}
