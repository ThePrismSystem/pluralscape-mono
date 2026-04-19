import { describe, expect, it, vi } from "vitest";

import type { CrowdinEnv } from "../../crowdin/env.js";
import { TARGET_LANGUAGE_IDS, type TargetLanguageId } from "../../crowdin/languages.js";
import {
  ENGINE_ROUTING,
  applyMtEngines,
  findMtEngineIds,
  type MtClient,
  MtCreationForbiddenError,
} from "../../crowdin/mt.js";

const DEEPL_MT_NAME = "deepl";
const GOOGLE_MT_NAME = "google";

class MethodNotAllowedError extends Error {
  code = 405;
  constructor(message = "Method Not Allowed") {
    super(message);
    this.name = "CrowdinError";
  }
}

function makeEnv(): CrowdinEnv {
  return {
    projectId: 100,
    token: "t",
    deeplApiKey: "deepl-key",
    googleCredentialsJson: JSON.stringify({
      type: "service_account",
      project_id: "p",
      private_key: "k",
      client_email: "a@b.com",
    }),
    googleCredentials: {
      type: "service_account",
      project_id: "p",
      private_key: "k",
      client_email: "a@b.com",
    },
  };
}

function makeMtClient(
  list: Array<{ id: number; name: string }>,
  overrides: Partial<MtClient["machineTranslationApi"]> = {},
): { client: MtClient; api: MtClient["machineTranslationApi"] } {
  const api: MtClient["machineTranslationApi"] = {
    listMts: vi.fn().mockResolvedValue({ data: list.map((e) => ({ data: e })) }),
    createMt: vi
      .fn()
      .mockImplementation(async (req: { name: string }) =>
        Promise.resolve({ data: { id: 999, name: req.name } }),
      ),
    updateMt: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  return { client: { machineTranslationApi: api }, api };
}

describe("ENGINE_ROUTING", () => {
  it("covers every TargetLanguageId exactly once", () => {
    const routedKeys = Object.keys(ENGINE_ROUTING).sort();
    const targetKeys = [...TARGET_LANGUAGE_IDS].sort();
    expect(routedKeys).toEqual(targetKeys);
  });

  it("routes ar to Google, es-419 to no MT engine, everything else to DeepL", () => {
    const byEngine: Record<"deepl" | "google" | "null", TargetLanguageId[]> = {
      deepl: [],
      google: [],
      null: [],
    };
    for (const [id, engine] of Object.entries(ENGINE_ROUTING) as Array<
      [TargetLanguageId, "deepl" | "google" | null]
    >) {
      byEngine[engine ?? "null"].push(id);
    }
    expect(byEngine.google.sort()).toEqual(["ar"]);
    expect(byEngine.null.sort()).toEqual(["es-419"]);
    expect(byEngine.deepl.sort()).toEqual([
      "de",
      "es-ES",
      "fr",
      "it",
      "ja",
      "ko",
      "nl",
      "pt-BR",
      "ru",
      "zh-CN",
    ]);
  });
});

describe("findMtEngineIds", () => {
  it("returns null when no DeepL engine is registered", async () => {
    const { client } = makeMtClient([{ id: 7, name: GOOGLE_MT_NAME }]);
    const result = await findMtEngineIds(client);
    expect(result).toBeNull();
  });

  it("returns null when no Google engine is registered", async () => {
    const { client } = makeMtClient([{ id: 7, name: DEEPL_MT_NAME }]);
    const result = await findMtEngineIds(client);
    expect(result).toBeNull();
  });

  it("returns both IDs when both engines exist exactly once", async () => {
    const { client } = makeMtClient([
      { id: 1, name: DEEPL_MT_NAME },
      { id: 2, name: GOOGLE_MT_NAME },
    ]);
    const result = await findMtEngineIds(client);
    expect(result).toEqual({ deeplId: 1, googleId: 2 });
  });

  it("throws when duplicate DeepL engines exist (race guard)", async () => {
    const { client } = makeMtClient([
      { id: 1, name: DEEPL_MT_NAME },
      { id: 5, name: DEEPL_MT_NAME },
      { id: 2, name: GOOGLE_MT_NAME },
    ]);
    await expect(findMtEngineIds(client)).rejects.toThrow(/Multiple MT engines/);
  });

  it("throws when duplicate Google engines exist (race guard)", async () => {
    const { client } = makeMtClient([
      { id: 1, name: DEEPL_MT_NAME },
      { id: 2, name: GOOGLE_MT_NAME },
      { id: 6, name: GOOGLE_MT_NAME },
    ]);
    await expect(findMtEngineIds(client)).rejects.toThrow(/Multiple MT engines/);
  });
});

describe("applyMtEngines", () => {
  it("creates both engines when neither exists", async () => {
    const { client, api } = makeMtClient([]);
    const create = api.createMt as ReturnType<typeof vi.fn>;
    create.mockResolvedValueOnce({ data: { id: 10, name: DEEPL_MT_NAME } });
    create.mockResolvedValueOnce({ data: { id: 11, name: GOOGLE_MT_NAME } });
    const result = await applyMtEngines(client, 100, makeEnv());
    expect(result).toEqual({ deeplId: 10, googleId: 11 });
    expect(create).toHaveBeenCalledTimes(2);
    expect(api.updateMt).not.toHaveBeenCalled();
  });

  it("reuses existing engines and PATCHes credentials + enabledProjectIds", async () => {
    const { client, api } = makeMtClient([
      { id: 42, name: DEEPL_MT_NAME },
      { id: 43, name: GOOGLE_MT_NAME },
    ]);
    const result = await applyMtEngines(client, 100, makeEnv());
    expect(result).toEqual({ deeplId: 42, googleId: 43 });
    expect(api.createMt).not.toHaveBeenCalled();
    const updateMt = api.updateMt as ReturnType<typeof vi.fn>;
    expect(updateMt).toHaveBeenCalledTimes(2);
    const [deeplCall, googleCall] = updateMt.mock.calls;
    expect(deeplCall?.[0]).toBe(42);
    const deeplPatch = deeplCall?.[1] as Array<{ path: string; value: unknown }>;
    expect(deeplPatch.map((p) => p.path)).toEqual(["/credentials", "/enabledProjectIds"]);
    expect(googleCall?.[0]).toBe(43);
  });

  it("throws when duplicate engines exist rather than silently picking one", async () => {
    const { client } = makeMtClient([
      { id: 1, name: DEEPL_MT_NAME },
      { id: 2, name: DEEPL_MT_NAME },
      { id: 3, name: GOOGLE_MT_NAME },
    ]);
    await expect(applyMtEngines(client, 100, makeEnv())).rejects.toThrow(/Multiple MT engines/);
  });

  it("throws MtCreationForbiddenError when createMt returns HTTP 405 (account tier blocks POST /mts)", async () => {
    const { client, api } = makeMtClient([]);
    const create = api.createMt as ReturnType<typeof vi.fn>;
    create.mockRejectedValueOnce(new MethodNotAllowedError());
    await expect(applyMtEngines(client, 100, makeEnv())).rejects.toBeInstanceOf(
      MtCreationForbiddenError,
    );
  });

  it("tolerates HTTP 405 on updateMt (PATCH /mts/{id}) and reuses the existing engine", async () => {
    const { client, api } = makeMtClient([
      { id: 42, name: DEEPL_MT_NAME },
      { id: 43, name: GOOGLE_MT_NAME },
    ]);
    (api.updateMt as ReturnType<typeof vi.fn>).mockRejectedValue(new MethodNotAllowedError());
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await applyMtEngines(client, 100, makeEnv());
      expect(result).toEqual({ deeplId: 42, googleId: 43 });
      expect(warnSpy).toHaveBeenCalledTimes(2);
      const messages = warnSpy.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes(DEEPL_MT_NAME) && m.includes("405"))).toBe(true);
      expect(messages.some((m) => m.includes(GOOGLE_MT_NAME) && m.includes("405"))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("rethrows non-405 errors from updateMt (no silent fallthrough on real failures)", async () => {
    const { client, api } = makeMtClient([
      { id: 42, name: DEEPL_MT_NAME },
      { id: 43, name: GOOGLE_MT_NAME },
    ]);
    (api.updateMt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("500 server error"));
    await expect(applyMtEngines(client, 100, makeEnv())).rejects.toThrow(/500 server error/);
  });
});
