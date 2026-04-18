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

  it("short-circuits on TM failure without firing DeepL or Google jobs", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }],
      statusSequences: { tm1: [{ status: "failed" }] },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes).toHaveLength(1);
    expect(result.passes[0]?.status).toBe("failed");
    const applyFn = client.translationsApi.applyPreTranslation;
    expect(applyFn).toHaveBeenCalledTimes(1);
  });

  it("short-circuits on DeepL failure before firing Google", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }, { identifier: "d1" }],
      statusSequences: {
        tm1: [{ status: "finished" }],
        d1: [{ status: "failed" }],
      },
    });
    const result = await runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 });
    expect(result.passes.map((p) => p.label)).toEqual(["TM", "MT (DeepL)"]);
    const applyFn = client.translationsApi.applyPreTranslation;
    expect(applyFn).toHaveBeenCalledTimes(2);
  });

  it("throws when the AbortSignal fires mid-poll", async () => {
    const client = mockClient({
      applyResults: [{ identifier: "tm1" }],
      statusSequences: { tm1: [{ status: "inProgress" }, { status: "inProgress" }] },
    });
    const controller = new AbortController();
    const p = runPretranslate(client, 100, { deeplMtId: 1, googleMtId: 2 }, controller.signal);
    queueMicrotask(() => controller.abort());
    await expect(p).rejects.toThrow(/aborted/);
  });
});
