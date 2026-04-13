/**
 * E2E tests for the SP import engine running against a real Pluralscape API.
 *
 * These tests boot Postgres, MinIO, and the API server via global-setup,
 * register a fresh account, run the import engine with a real tRPC-backed
 * persister, and verify entities persist correctly by querying import refs.
 *
 * Test suites are gated on fixture/env availability:
 * - File source: requires scripts/.sp-test-{minimal,adversarial}-export.json
 * - API source: requires SP_TEST_LIVE_API=true and API keys in .env.sp-test
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { runImport } from "../../engine/import-engine.js";
import {
  createApiSource,
  createFileSource,
  loadManifest,
  makeInitialCheckpoint,
} from "../integration/helpers.js";

import {
  createE2EPersister,
  getSystemId,
  makeTrpcClient,
  registerTestAccount,
} from "./e2e-helpers.js";
import {
  assertMembers,
  assertGroups,
  assertCustomFronts,
  assertFieldDefinitions,
  assertPrivacyBuckets,
  assertFrontingSessions,
  assertFrontingComments,
  assertNotes,
  assertPolls,
  assertChannelCategories,
  assertChannels,
  assertChatMessages,
  assertBoardMessages,
} from "./entity-assertions.js";

import type { E2EPersisterCtx as E2EPersisterContext, TRPCClient } from "./e2e-helpers.js";
import type { ImportRunResult } from "../../engine/import-engine.js";
import type { Manifest } from "../integration/manifest.types.js";
import type { ImportCheckpointState } from "@pluralscape/types";

const MONOREPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

// ── Guard helpers ───────────────────────────────────────────────────

function hasLiveApiEnabled(): boolean {
  return (
    process.env["SP_TEST_LIVE_API"] === "true" &&
    typeof process.env["SP_TEST_MINIMAL_API_KEY"] === "string" &&
    process.env["SP_TEST_MINIMAL_API_KEY"].length > 0 &&
    typeof process.env["SP_TEST_ADVERSARIAL_API_KEY"] === "string" &&
    process.env["SP_TEST_ADVERSARIAL_API_KEY"].length > 0
  );
}

function hasExportFixtures(): boolean {
  return (
    existsSync(path.join(MONOREPO_ROOT, "scripts/.sp-test-minimal-export.json")) &&
    existsSync(path.join(MONOREPO_ROOT, "scripts/.sp-test-adversarial-export.json"))
  );
}

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
    let manifest: Manifest;
    let result: ImportRunResult;
    let trpc: TRPCClient;
    let ctx: E2EPersisterContext;

    beforeAll(async () => {
      manifest = await loadManifest(mode);

      const account = await registerTestAccount();
      trpc = makeTrpcClient(account.sessionToken);
      const systemId = await getSystemId(account.sessionToken);
      ctx = await createE2EPersister(trpc, systemId);

      const source =
        sourceLabel === "file"
          ? await createFileSource(mode, manifest)
          : createApiSource(mode, manifest);

      result = await runImport({
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
      // Mapper-level FK misses are expected (e.g., friends, field values
      // referencing missing field definitions). Verify none are unexpected
      // persister-level failures.
      const nonFatal = result.errors.filter((e) => !e.fatal);
      for (const e of nonFatal) {
        // Every non-fatal error should be a recognized mapper failure kind
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

    // ── Per-entity-type field value assertions ───────────────────────

    it("members have correct field values", async () => {
      await assertMembers(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("groups have correct field values", async () => {
      await assertGroups(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("custom fronts have correct field values", async () => {
      await assertCustomFronts(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("field definitions have correct field values", async () => {
      await assertFieldDefinitions(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("privacy buckets have correct field values", async () => {
      await assertPrivacyBuckets(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("fronting sessions have correct field values", async () => {
      await assertFrontingSessions(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("notes have correct field values", async () => {
      await assertNotes(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("polls have correct field values", async () => {
      await assertPolls(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("channel categories have correct field values", async () => {
      await assertChannelCategories(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    it("channels have correct field values", async () => {
      await assertChannels(trpc, ctx.masterKey, ctx.systemId, manifest);
    });

    // File-only entity types (comments, chat messages, board messages
    // are only present in file-source fixtures, not live API exports).
    if (sourceLabel === "file") {
      it("fronting comments have correct field values", async () => {
        await assertFrontingComments(trpc, ctx.masterKey, ctx.systemId, manifest);
      });

      it("chat messages have correct field values", async () => {
        await assertChatMessages(trpc, ctx.masterKey, ctx.systemId, manifest);
      });

      it("board messages have correct field values", async () => {
        await assertBoardMessages(trpc, ctx.masterKey, ctx.systemId, manifest);
      });
    }
  });
}

// ── File Source tests ───────────────────────────────────────────────

describe.skipIf(!hasExportFixtures())("SP Import E2E — File Source", () => {
  defineImportSuite("minimal export — full import", "minimal", "file");
  defineImportSuite("adversarial export — full import", "adversarial", "file");
});

// ── API Source tests ────────────────────────────────────────────────

describe.skipIf(!hasLiveApiEnabled())("SP Import E2E — API Source", () => {
  defineImportSuite("minimal account — full import", "minimal", "api");
  defineImportSuite("adversarial account — full import", "adversarial", "api");
});

// ── Checkpoint Resume tests ─────────────────────────────────────────

describe.skipIf(!hasExportFixtures())("SP Import E2E — Checkpoint Resume", () => {
  it("resumes from an aborted checkpoint and completes", async () => {
    const manifest = await loadManifest("minimal");

    // Set up a fresh account for the resume test
    const account = await registerTestAccount();
    const trpc = makeTrpcClient(account.sessionToken);
    const systemId = await getSystemId(account.sessionToken);

    // First run: abort after 3 progress callbacks
    const abortController = new AbortController();
    let progressCount = 0;
    const ABORT_AFTER_PROGRESS = 3;
    let abortedCheckpoint: ImportCheckpointState | undefined;

    const abortCtx = await createE2EPersister(trpc, systemId);
    const abortResult = await runImport({
      source: await createFileSource("minimal", manifest),
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
    const resumeCtx = await createE2EPersister(trpc, systemId);
    const resumeResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister: resumeCtx.persister,
      initialCheckpoint: abortedCheckpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(resumeResult.outcome).toBe("completed");
    expect(resumeResult.errors.filter((e) => e.fatal)).toHaveLength(0);
  });
});
