/**
 * E2E tests for the PK import engine running against a real Pluralscape API.
 *
 * These tests boot Postgres, MinIO, and the API server via global-setup,
 * register a fresh account, run the import engine with a real tRPC-backed
 * persister, and verify entities persist correctly by querying import refs.
 *
 * Test suites are gated on fixture/env availability:
 * - File source: requires scripts/.pk-test-{minimal,adversarial}-export.json
 *   and scripts/.pk-seed-{minimal,adversarial}-manifest.json
 * - API source: requires PK_TEST_LIVE_API=true and PK tokens in env
 */
import { describe, it, expect, beforeAll } from "vitest";

import { runPkImport } from "../../run-pk-import.js";

import {
  createApiSource,
  createFileSource,
  createPkE2EPersister,
  getSystemId,
  hasExportFixtures,
  hasLiveApiEnabled,
  hasManifests,
  loadManifest,
  makeInitialCheckpoint,
  makeTrpcClient,
  registerTestAccount,
} from "./e2e-helpers.js";
import {
  assertPkFrontingSessions,
  assertPkGroups,
  assertPkMembers,
  assertPkPrivacyBuckets,
} from "./entity-assertions.js";

import type { E2EPersisterCtx as E2EPersisterContext, TRPCClient } from "./e2e-helpers.js";
import type { PkManifest } from "../integration/manifest.types.js";
import type { ImportRunResult } from "@pluralscape/import-core";
import type { ImportCheckpointState } from "@pluralscape/types";

// ── No-op progress ──────────────────────────────────────────────────

function noopProgress(): Promise<void> {
  return Promise.resolve();
}

// ── Parameterized import suite ──────────────────────────────────────

type SourceLabel = "file" | "api";

function defineImportSuite(
  label: string,
  mode: "minimal" | "adversarial",
  sourceLabel: SourceLabel,
): void {
  describe(label, () => {
    let manifest: PkManifest;
    let result: ImportRunResult;
    let trpc: TRPCClient;
    let ctx: E2EPersisterContext;

    beforeAll(async () => {
      manifest = loadManifest(mode);

      const account = await registerTestAccount();
      trpc = makeTrpcClient(account.sessionToken);
      const systemId = await getSystemId(account.sessionToken);
      ctx = await createPkE2EPersister(trpc, systemId);

      const source =
        sourceLabel === "file" ? createFileSource(mode) : createApiSource(mode, manifest);

      result = await runPkImport({
        source,
        persister: ctx.persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      });
    });

    it("completes without aborting", () => {
      expect(result.outcome).toBe("completed");
    });

    it("produces zero fatal errors", () => {
      const fatalErrors = result.errors.filter((e) => e.fatal);
      expect(fatalErrors).toHaveLength(0);
    });

    it("non-fatal errors are all expected mapper failures", () => {
      const nonFatal = result.errors.filter((e) => !e.fatal);
      for (const e of nonFatal) {
        expect(
          ["fk-miss", "invalid-source-document", "validation-failed", undefined].includes(
            (e as { kind?: string }).kind,
          ),
          `unexpected non-fatal error kind: ${JSON.stringify(e)}`,
        ).toBe(true);
      }
    });

    it("created entities on the server", () => {
      expect(ctx.getCreatedCount()).toBeGreaterThan(0);
    });

    it("members have correct field values", async () => {
      await assertPkMembers(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("groups have correct field values", async () => {
      await assertPkGroups(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("fronting sessions have correct field values", async () => {
      await assertPkFrontingSessions(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("privacy buckets have correct field values", async () => {
      await assertPkPrivacyBuckets(trpc, ctx.masterKey, ctx.systemId);
    });
  });
}

// ── File Source tests ───────────────────────────────────────────────

const canRunFileSource = hasExportFixtures() && hasManifests();

describe.skipIf(!canRunFileSource)("PK Import E2E — File Source", () => {
  defineImportSuite("minimal export — full import", "minimal", "file");
  defineImportSuite("adversarial export — full import", "adversarial", "file");
});

// ── API Source tests ────────────────────────────────────────────────

const canRunApiSource = hasLiveApiEnabled() && hasManifests();

describe.skipIf(!canRunApiSource)("PK Import E2E — API Source", () => {
  defineImportSuite("minimal account — full import", "minimal", "api");
  defineImportSuite("adversarial account — full import", "adversarial", "api");
});

// ── Checkpoint Resume tests ─────────────────────────────────────────

describe.skipIf(!canRunFileSource)("PK Import E2E — Checkpoint Resume", () => {
  it("resumes from an aborted checkpoint and completes", async () => {
    const account = await registerTestAccount();
    const trpc = makeTrpcClient(account.sessionToken);
    const systemId = await getSystemId(account.sessionToken);

    // First run: abort after 3 progress callbacks
    const abortController = new AbortController();
    let progressCount = 0;
    const ABORT_AFTER_PROGRESS = 3;
    let abortedCheckpoint: ImportCheckpointState | undefined;

    const abortCtx = await createPkE2EPersister(trpc, systemId);
    const abortResult = await runPkImport({
      source: createFileSource("minimal"),
      persister: abortCtx.persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: (state) => {
        progressCount += 1;
        if (progressCount >= ABORT_AFTER_PROGRESS) {
          abortedCheckpoint = state;
          abortController.abort();
        }
        return Promise.resolve();
      },
      abortSignal: abortController.signal,
    });

    expect(abortResult.outcome).toBe("aborted");
    expect(abortedCheckpoint).toBeDefined();
    if (!abortedCheckpoint) {
      throw new Error("abort checkpoint was not captured");
    }

    const entitiesAfterAbort = abortCtx.getCreatedCount();
    expect(entitiesAfterAbort).toBeGreaterThan(0);

    // Second run: resume from the aborted checkpoint with a new persister
    // on the same account (entities from the first run already exist).
    const resumeCtx = await createPkE2EPersister(trpc, systemId);
    const resumeResult = await runPkImport({
      source: createFileSource("minimal"),
      persister: resumeCtx.persister,
      initialCheckpoint: abortedCheckpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(resumeResult.outcome).toBe("completed");
    expect(resumeResult.errors.filter((e) => e.fatal)).toHaveLength(0);
  });
});
