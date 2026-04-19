import { describe, expect, it, vi } from "vitest";

import { type PretranslateClient, runPretranslate } from "../../crowdin/pretranslate.js";

interface MockedClient extends PretranslateClient {
  readonly translationsApi: {
    applyPreTranslation: ReturnType<typeof vi.fn> &
      PretranslateClient["translationsApi"]["applyPreTranslation"];
    preTranslationStatus: ReturnType<typeof vi.fn> &
      PretranslateClient["translationsApi"]["preTranslationStatus"];
  };
}

function mockClient(plan: {
  applyResults: Array<{ identifier: string }>;
  statusSequences: Record<string, Array<{ status: string }>>;
}): MockedClient {
  let applyIdx = 0;
  const statusIdx: Record<string, number> = {};
  const apply = vi.fn(async () => {
    const r = plan.applyResults[applyIdx++];
    if (!r) throw new Error("mockClient: applyResults exhausted");
    return { data: { identifier: r.identifier } };
  });
  const status = vi.fn(async (_projectId: number, identifier: string) => {
    const seq = plan.statusSequences[identifier] ?? [{ status: "finished" }];
    const i = statusIdx[identifier] ?? 0;
    statusIdx[identifier] = i + 1;
    const entry = seq[Math.min(i, seq.length - 1)];
    if (!entry) throw new Error(`mockClient: empty sequence for ${identifier}`);
    return { data: { status: entry.status } };
  });
  return {
    translationsApi: {
      applyPreTranslation: apply as MockedClient["translationsApi"]["applyPreTranslation"],
      preTranslationStatus: status as MockedClient["translationsApi"]["preTranslationStatus"],
    },
  };
}

describe("runPretranslate", () => {
  it("runs all 3 passes in order with autoApproveOption: all", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }, { identifier: "d1" }, { identifier: "g1" }],
      statusSequences: {
        tm1: [{ status: "finished" }],
        d1: [{ status: "finished" }],
        g1: [{ status: "finished" }],
      },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes).toHaveLength(3);
    expect(result.passes.map((p) => p.label)).toEqual(["TM", "MT (DeepL)", "MT (Google)"]);
    const applyFn = client.translationsApi.applyPreTranslation;
    expect(applyFn).toHaveBeenCalledTimes(3);
    for (const call of applyFn.mock.calls) {
      const payload = call[1] as {
        autoApproveOption?: string;
        translateUntranslatedOnly?: boolean;
      };
      expect(payload.autoApproveOption).toBe("all");
      expect(payload.translateUntranslatedOnly).toBe(true);
    }
  });

  it("on TM failure skips DeepL and Google passes (no additional API calls)", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }],
      statusSequences: { tm1: [{ status: "failed" }] },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes).toHaveLength(3);
    expect(result.passes[0]?.status).toBe("failed");
    expect(result.passes.slice(1).map((p) => p.status)).toEqual([
      "skipped_due_to_prior_failure",
      "skipped_due_to_prior_failure",
    ]);
    const applyFn = client.translationsApi.applyPreTranslation;
    expect(applyFn).toHaveBeenCalledTimes(1);
  });

  it("on DeepL failure skips Google pass but still reports its slot", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }, { identifier: "d1" }],
      statusSequences: {
        tm1: [{ status: "finished" }],
        d1: [{ status: "failed" }],
      },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes.map((p) => p.label)).toEqual(["TM", "MT (DeepL)", "MT (Google)"]);
    expect(result.passes.map((p) => p.status)).toEqual([
      "finished",
      "failed",
      "skipped_due_to_prior_failure",
    ]);
    const applyFn = client.translationsApi.applyPreTranslation;
    expect(applyFn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately if signal is already aborted before first poll", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }],
      statusSequences: { tm1: [{ status: "inProgress" }] },
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 }, controller.signal),
    ).rejects.toThrow(/aborted/);
  });

  it("throws when the AbortSignal fires during the poll setTimeout", async () => {
    vi.useFakeTimers();
    try {
      const client = mockClient({
        applyResults: [{ identifier: "tm1" }],
        statusSequences: { tm1: [{ status: "inProgress" }, { status: "inProgress" }] },
      });
      const controller = new AbortController();
      const promise = runPretranslate(
        client,
        100,
        { deeplMtId: 1, googleMtId: 2 },
        controller.signal,
      );
      // Let applyPreTranslation + first status poll resolve synchronously.
      await vi.advanceTimersByTimeAsync(0);
      // At this point delay() has attached its listener. Fire abort.
      controller.abort();
      await expect(promise).rejects.toThrow(/aborted/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out after POLL_TIMEOUT_MS when status never reaches a terminal state", async () => {
    vi.useFakeTimers();
    try {
      const client = mockClient({
        applyResults: [{ identifier: "tm1" }],
        // Every poll returns inProgress — should eventually exceed POLL_TIMEOUT_MS.
        statusSequences: { tm1: [{ status: "inProgress" }] },
      });
      const promise = runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
      // Prevent unhandled-rejection noise while timers are still being advanced.
      promise.catch(() => {
        /* asserted below */
      });
      // Advance past POLL_TIMEOUT_MS (10 min). The poll loop checks Date.now
      // against the saved start time, then awaits setTimeout(5s). Single
      // large jump advances both the clock and queued timers.
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
      await expect(promise).rejects.toThrow(/timed out/);
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);

  it("marks subsequent passes as skipped_due_to_prior_failure on first failure", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }],
      statusSequences: { tm1: [{ status: "failed" }] },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    const statuses = result.passes.map((p) => p.status);
    expect(statuses[0]).toBe("failed");
    // TM pass failed; DeepL + Google should be recorded as skipped.
    expect(statuses.slice(1)).toEqual([
      "skipped_due_to_prior_failure",
      "skipped_due_to_prior_failure",
    ]);
  });

  it("surfaces failureContext (status + languageIds) on failed pass", async () => {
    const apply = vi.fn().mockResolvedValue({ data: { identifier: "tm1" } });
    const status = vi.fn().mockResolvedValue({
      data: {
        status: "failed",
        progress: 42,
        attributes: { languageIds: ["fr", "de"], labelIds: [7] },
      },
    });
    const client: MockedClient = {
      translationsApi: {
        applyPreTranslation: apply as MockedClient["translationsApi"]["applyPreTranslation"],
        preTranslationStatus: status as MockedClient["translationsApi"]["preTranslationStatus"],
      },
    };
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes[0]?.failureContext).toEqual({
      status: "failed",
      progress: 42,
      labelIds: [7],
      languageIds: ["fr", "de"],
    });
  });
});
