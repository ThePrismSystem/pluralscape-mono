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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { emptyCheckpointState } from "../../engine/checkpoint.js";
import { collectionToEntityType } from "../../engine/entity-type-map.js";
import { runImport } from "../../engine/import-engine.js";
import { createFileImportSource, FileSourceParseError } from "../../sources/file-source.js";
import { createInMemoryPersister } from "../helpers/in-memory-persister.js";
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
import type { ImportDataSource, SourceEvent } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";
import type { Manifest } from "../integration/manifest.types.js";
import type {
  ImportAvatarMode,
  ImportCheckpointState,
  ImportCollectionType,
} from "@pluralscape/types";

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

// ── File Source Error Paths ─────────────────────────────────────────
//
// Error-path coverage for the file-source import. These tests exercise
// failure modes that should surface as typed errors rather than silent
// data loss. They use the in-memory persister where the persister itself
// is not under test (parse failures, source-level iteration failures,
// option plumbing) and the real tRPC-backed persister where idempotency
// and checkpoint-resume equivalence depend on server-side behavior.
//
// Live-API variants of these scenarios remain gated behind
// `SP_TEST_LIVE_API=true` and are not duplicated here.

const MINIMAL_EXPORT_PATH = path.join(MONOREPO_ROOT, "scripts/.sp-test-minimal-export.json");

/** Wrap raw JSON bytes in a ReadableStream the file-source can consume. */
function streamFromString(json: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(json);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/**
 * Decorate a real file-source so that iterating a specific collection
 * throws the given error. Used to simulate a source-level network / I/O
 * failure mid-run without introducing a dedicated mock layer: the engine
 * sees the same interface it would in production and classifies the
 * thrown error through its normal error path.
 */
function failingIterateSource(
  inner: ImportDataSource,
  targetCollection: SpCollectionName,
  error: Error,
): ImportDataSource {
  async function* forwardInner(collection: SpCollectionName): AsyncGenerator<SourceEvent> {
    for await (const event of inner.iterate(collection)) {
      yield event;
    }
  }
  async function* throwing(): AsyncGenerator<SourceEvent> {
    // Yield once to the microtask queue so this is a well-formed async
    // generator; the await satisfies require-await without affecting
    // the thrown-error semantics the engine tests rely on.
    await Promise.resolve();
    throw error;
  }
  return {
    mode: inner.mode,
    listCollections: () => inner.listCollections(),
    iterate(collection: SpCollectionName): AsyncIterable<SourceEvent> {
      if (collection === targetCollection) {
        return throwing();
      }
      return forwardInner(collection);
    },
    close: () => inner.close(),
  };
}

describe.skipIf(!hasExportFixtures())("SP Import E2E — File Source Error Paths", () => {
  it("malformed JSON surfaces FileSourceParseError rather than a raw parse error", async () => {
    const { persister } = createInMemoryPersister();
    const source = createFileImportSource({
      stream: streamFromString('{ "members": [ { "_id": "m1", "name": '),
    });

    await expect(
      runImport({
        source,
        persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      }),
    ).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("non-array value for a known collection surfaces FileSourceParseError", async () => {
    // Valid JSON, but "members" is a string instead of the expected array.
    // The file-source prescan validates every recognized top-level collection
    // is array-valued; a scalar triggers a typed parse error, not a silent
    // downstream validation miss.
    const { persister } = createInMemoryPersister();
    const source = createFileImportSource({
      stream: streamFromString('{ "members": "not-an-array" }'),
    });

    await expect(
      runImport({
        source,
        persister,
        initialCheckpoint: makeInitialCheckpoint(),
        options: { selectedCategories: {}, avatarMode: "skip" },
        onProgress: noopProgress,
      }),
    ).rejects.toBeInstanceOf(FileSourceParseError);
  });

  it("source iteration failure (simulated network error) aborts with a fatal error", async () => {
    // Stand in for a transient I/O failure on the members endpoint: the
    // real avatar/network layer sits outside the engine (mobile glue), so
    // we simulate an equivalent failure at the ImportDataSource boundary.
    // The engine MUST abort with a fatal recoverable error rather than
    // swallowing the failure and producing a partial successful run.
    const manifest = await loadManifest("minimal");
    const inner = await createFileSource("minimal", manifest);
    const source = failingIterateSource(
      inner,
      "members",
      new Error("ECONNRESET: simulated avatar-fetcher network failure"),
    );
    const { persister, snapshot } = createInMemoryPersister();

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("aborted");
    const fatal = result.errors.find((e) => e.fatal);
    expect(fatal?.message).toContain("ECONNRESET");
    // Collections before `members` in DEPENDENCY_ORDER should still have
    // been imported — the failure is localized to members and the engine
    // does not discard earlier work.
    expect(snapshot().size).toBeGreaterThan(0);
  });

  // Requirement (4) "Invalid/expired token" is intentionally skipped here:
  // the file source reads from a local JSON fixture and performs no token
  // validation. Live API token-rejection paths are covered by the manual
  // `hasLiveApiEnabled()`-gated `ApiSourceTokenRejectedError` classification
  // in apps/api integration tests; reproducing that scenario in file-source
  // mode would require fabricating a code path the source does not take.
  it.skip("invalid/expired token — not applicable to file-source mode", () => {
    // Intentionally empty. See comment above.
  });

  it("partial category selection imports only the selected collections", async () => {
    // Opt every collection OUT except members. The engine should walk the
    // dependency order but advance past every non-member collection without
    // persisting anything, producing a member-only result set.
    const manifest = await loadManifest("minimal");
    const source = await createFileSource("minimal", manifest);
    const { persister, snapshot } = createInMemoryPersister();

    const selectedCategories: Partial<Record<ImportCollectionType, boolean>> = {
      member: true,
      "privacy-bucket": false,
      "field-definition": false,
      "custom-front": false,
      group: false,
      "fronting-session": false,
      "fronting-comment": false,
      "journal-entry": false,
      poll: false,
      "channel-category": false,
      channel: false,
      "chat-message": false,
      "board-message": false,
      "system-profile": false,
      "system-settings": false,
    };

    const result = await runImport({
      source,
      persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories, avatarMode: "skip" },
      onProgress: noopProgress,
    });

    expect(result.outcome).toBe("completed");
    const snap = snapshot();
    // Members imported. Legacy bucket synthesis still fires when the
    // source has no privacyBuckets collection and members need synthetic
    // references — that path is independent of the selectedCategories
    // opt-out and is expected. We therefore allow privacy-bucket to be
    // non-zero but assert every other opted-out type is empty.
    expect(snap.countByType("member")).toBeGreaterThan(0);
    for (const optedOut of [
      "field-definition",
      "custom-front",
      "group",
      "fronting-session",
      "fronting-comment",
      "journal-entry",
      "poll",
      "channel-category",
      "channel",
      "chat-message",
      "board-message",
    ] as const) {
      expect(snap.countByType(optedOut), `expected no ${optedOut} entities`).toBe(0);
    }
  });

  for (const mode of ["skip", "api"] as const satisfies readonly ImportAvatarMode[]) {
    it(`avatarMode "${mode}" is preserved in final checkpoint state`, async () => {
      // The engine does not fetch avatar bytes itself — that responsibility
      // lives in the mobile glue, which consults `finalState.options.avatarMode`
      // to decide whether to download, read from a companion ZIP, or skip.
      // This test pins the engine-side contract: the avatarMode baked into
      // the initial checkpoint must round-trip unchanged into the final
      // checkpoint so downstream consumers see the same value on resume or
      // completion.
      //
      // Engine semantics: when `initialCheckpoint` is supplied, its `options`
      // subtree is authoritative — `args.options.avatarMode` is only consumed
      // to seed a fresh checkpoint via `emptyCheckpointState`. Build the
      // initial checkpoint with the mode under test so we exercise the
      // round-trip path rather than the ignored-args path.
      const manifest = await loadManifest("minimal");
      const source = await createFileSource("minimal", manifest);
      const { persister } = createInMemoryPersister();

      const initialCheckpoint = emptyCheckpointState({
        firstEntityType: collectionToEntityType("users"),
        selectedCategories: {},
        avatarMode: mode,
      });

      const result = await runImport({
        source,
        persister,
        initialCheckpoint,
        options: { selectedCategories: {}, avatarMode: mode },
        onProgress: noopProgress,
      });

      expect(result.outcome).toBe("completed");
      expect(result.finalState.options.avatarMode).toBe(mode);
    });
  }

  it("running the same import twice does not duplicate entities (idempotency)", async () => {
    // Idempotency contract: with the persister's ref table preserved across
    // runs, a re-import of the same source MUST result in zero new creates.
    // The in-memory persister mirrors the real persister's content-hash
    // skip behavior, so content-identical re-upserts return `skipped`.
    const manifest = await loadManifest("minimal");
    const { persister, snapshot } = createInMemoryPersister();

    const firstResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(firstResult.outcome).toBe("completed");
    const sizeAfterFirst = snapshot().size;
    expect(sizeAfterFirst).toBeGreaterThan(0);

    const secondResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(secondResult.outcome).toBe("completed");
    // The store must contain the same set of entities after the second
    // run — no duplicates, no new rows.
    expect(snapshot().size).toBe(sizeAfterFirst);
  });

  it("checkpoint resume produces the same final entity set as a full run", async () => {
    // Equivalence contract: aborting mid-run and resuming from the captured
    // checkpoint must land on the same entity set as a fresh uninterrupted
    // run. The engine now persists `realPrivacyBucketsMapped` in the
    // checkpoint (ps-beng), so resumed runs no longer re-synthesize legacy
    // buckets when the source had real ones. Baseline and resumed entity
    // sets must be byte-identical.
    const manifest = await loadManifest("minimal");

    // Baseline: fresh persister, single uninterrupted run.
    const { persister: baselinePersister, snapshot: baselineSnapshot } = createInMemoryPersister();
    const baselineResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister: baselinePersister,
      initialCheckpoint: makeInitialCheckpoint(),
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(baselineResult.outcome).toBe("completed");
    const baselineKeys = baselineSnapshot()
      .entities.map((e) => `${e.entityType}:${e.sourceEntityId}`)
      .sort();
    expect(baselineKeys.length).toBeGreaterThan(0);

    // Abort + resume against a fresh persister. Using a single persister
    // across both partial runs mirrors the real mobile glue where import
    // state survives across engine invocations within a session.
    const { persister: resumePersister, snapshot: resumeSnapshot } = createInMemoryPersister();
    const abortController = new AbortController();
    let progressCount = 0;
    const ABORT_AFTER_PROGRESS = 3;
    let abortedCheckpoint: ImportCheckpointState | undefined;

    const abortResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister: resumePersister,
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
    if (!abortedCheckpoint) {
      throw new Error("abort checkpoint was not captured");
    }

    const resumeResult = await runImport({
      source: await createFileSource("minimal", manifest),
      persister: resumePersister,
      initialCheckpoint: abortedCheckpoint,
      options: { selectedCategories: {}, avatarMode: "skip" },
      onProgress: noopProgress,
    });
    expect(resumeResult.outcome).toBe("completed");

    const resumedKeys = resumeSnapshot()
      .entities.map((e) => `${e.entityType}:${e.sourceEntityId}`)
      .sort();

    // Engine now persists `realPrivacyBucketsMapped` in the checkpoint, so
    // resumed runs no longer re-synthesize legacy buckets when the source had
    // real ones. Baseline and resumed entity sets must be byte-identical.
    expect(resumedKeys).toEqual(baselineKeys);
  });

  // Smoke assertion to anchor readFileSync import usage in the error-path
  // tests — confirms the fixture on disk is well-formed JSON so any later
  // test that reports a parse error is flagging engine-side behavior, not
  // a corrupted fixture.
  it("minimal export fixture parses as valid JSON (baseline sanity)", () => {
    const raw = readFileSync(MINIMAL_EXPORT_PATH, "utf-8");
    // Wrap in a void assertion so the `any` that JSON.parse returns is not
    // flowed back out of the test closure; we only care that parsing did
    // not throw.
    expect(() => {
      JSON.parse(raw) as unknown;
    }).not.toThrow();
  });
});
