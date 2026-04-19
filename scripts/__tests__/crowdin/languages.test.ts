import { describe, expect, it, vi } from "vitest";

import {
  TARGET_LANGUAGE_IDS,
  applyTargetLanguages,
  diffLanguages,
  type LanguagesClient,
} from "../../crowdin/languages.js";

describe("TARGET_LANGUAGE_IDS", () => {
  it("contains all 12 target languages", () => {
    expect(TARGET_LANGUAGE_IDS).toEqual([
      "ar",
      "de",
      "es-ES",
      "es-419",
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

describe("diffLanguages", () => {
  it("reports no-op when already matching", () => {
    const diff = diffLanguages(["ar", "de"], ["ar", "de"]);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
  });

  it("reports additions", () => {
    const diff = diffLanguages(["ar", "de", "fr"], ["ar"]);
    expect(diff.toAdd).toEqual(["de", "fr"]);
    expect(diff.toRemove).toEqual([]);
  });

  it("reports removals", () => {
    const diff = diffLanguages(["ar"], ["ar", "de"]);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual(["de"]);
  });

  it("handles both adds and removes", () => {
    const diff = diffLanguages(["ar", "fr"], ["ar", "de"]);
    expect(diff.toAdd).toEqual(["fr"]);
    expect(diff.toRemove).toEqual(["de"]);
  });
});

describe("applyTargetLanguages", () => {
  function makeClient(currentIds: string[]): {
    client: LanguagesClient;
    editProject: ReturnType<typeof vi.fn>;
  } {
    const editProject = vi.fn().mockResolvedValue({});
    const client: LanguagesClient = {
      projectsGroupsApi: {
        getProject: vi.fn().mockResolvedValue({ data: { targetLanguageIds: currentIds } }),
        editProject,
      },
    };
    return { client, editProject };
  }

  it("no-op when current matches TARGET_LANGUAGE_IDS", async () => {
    const { client, editProject } = makeClient([...TARGET_LANGUAGE_IDS]);
    const diff = await applyTargetLanguages(client, 100);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual([]);
    expect(editProject).not.toHaveBeenCalled();
  });

  it("PATCHes when languages need to be added", async () => {
    const { client, editProject } = makeClient(["ar"]);
    const diff = await applyTargetLanguages(client, 100);
    expect(diff.toAdd.length).toBeGreaterThan(0);
    expect(editProject).toHaveBeenCalledTimes(1);
  });

  it("PATCHes when languages need to be removed", async () => {
    const { client, editProject } = makeClient([...TARGET_LANGUAGE_IDS, "obsolete-xx"]);
    const diff = await applyTargetLanguages(client, 100);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toRemove).toEqual(["obsolete-xx"]);
    expect(editProject).toHaveBeenCalledTimes(1);
  });

  it("PATCHes when both adds and removes are needed", async () => {
    const { client, editProject } = makeClient(["ar", "obsolete-xx"]);
    const diff = await applyTargetLanguages(client, 100);
    expect(diff.toAdd.length).toBeGreaterThan(0);
    expect(diff.toRemove).toEqual(["obsolete-xx"]);
    expect(editProject).toHaveBeenCalledTimes(1);
  });
});
