import type { GlossariesModel } from "@crowdin/crowdin-api-client";
import { describe, expect, it, vi } from "vitest";

import type { CrowdinClient } from "../../crowdin/client.js";
import type { GlossaryTerm } from "../../crowdin/glossary-schema.js";
import { applyGlossary, diffGlossaryTerms, termToCrowdinPayload } from "../../crowdin/glossary.js";

const local: GlossaryTerm[] = [
  { term: "system", type: "translatable", notes: "A collective." },
  { term: "fronting", type: "translatable", notes: "Executive control.", hazard: "critical" },
];

describe("diffGlossaryTerms", () => {
  it("adds terms missing from remote", () => {
    const diff = diffGlossaryTerms(local, []);
    expect(diff.toAdd).toHaveLength(2);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.toRemove).toEqual([]);
  });

  it("updates terms whose description changed", () => {
    const remote = [
      { id: 1, text: "system", description: "Old description.", status: "preferred" },
    ];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0]?.id).toBe(1);
    expect(diff.toAdd.map((t) => t.term)).toEqual(["fronting"]);
  });

  it("removes terms no longer present locally", () => {
    const remote = [
      { id: 1, text: "system", description: "A collective.", status: "preferred" },
      {
        id: 2,
        text: "fronting",
        description: "[HAZARD: critical] Executive control.",
        status: "preferred",
      },
      { id: 99, text: "obsolete", description: "Old term.", status: "preferred" },
    ];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toRemove).toEqual([99]);
  });

  it("treats description + status match as unchanged", () => {
    const remote = [
      { id: 1, text: "system", description: "A collective.", status: "preferred" },
      {
        id: 2,
        text: "fronting",
        description: "[HAZARD: critical] Executive control.",
        status: "preferred",
      },
    ];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
  });

  it("case-insensitive term matching", () => {
    const remote = [{ id: 1, text: "SYSTEM", description: "A collective.", status: "preferred" }];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toAdd.map((t) => t.term)).toEqual(["fronting"]);
  });
});

describe("diffGlossaryTerms — full-payload comparison", () => {
  function makeRemoteMatching(): Array<{
    id: number;
    text: string;
    description?: string;
    status?: string;
    partOfSpeech?: GlossariesModel.PartOfSpeech;
  }> {
    return [
      {
        id: 1,
        text: "system",
        description: "A COLLECTIVE OF HEADMATES...",
        status: "preferred",
        partOfSpeech: "noun",
      },
    ];
  }

  it("updates when only status differs (type flip from translatable to do-not-translate)", () => {
    const localTerms: GlossaryTerm[] = [
      {
        term: "system",
        type: "do-not-translate",
        pos: "noun",
        notes: "A COLLECTIVE OF HEADMATES...",
      },
    ];
    const diff = diffGlossaryTerms(localTerms, makeRemoteMatching());
    expect(diff.toUpdate).toHaveLength(1);
  });

  it("updates when only partOfSpeech differs", () => {
    const localTerms: GlossaryTerm[] = [
      {
        term: "system",
        type: "translatable",
        pos: "adj",
        notes: "A COLLECTIVE OF HEADMATES...",
      },
    ];
    const diff = diffGlossaryTerms(localTerms, makeRemoteMatching());
    expect(diff.toUpdate).toHaveLength(1);
  });

  it("does not update when description + status + partOfSpeech all match", () => {
    const localTerms: GlossaryTerm[] = [
      {
        term: "system",
        type: "translatable",
        pos: "noun",
        notes: "A COLLECTIVE OF HEADMATES...",
      },
    ];
    const diff = diffGlossaryTerms(localTerms, makeRemoteMatching());
    expect(diff.toUpdate).toHaveLength(0);
  });

  it("still updates when description differs (existing behavior preserved)", () => {
    const localTerms: GlossaryTerm[] = [
      {
        term: "system",
        type: "translatable",
        pos: "noun",
        notes: "Different description.",
      },
    ];
    const diff = diffGlossaryTerms(localTerms, makeRemoteMatching());
    expect(diff.toUpdate).toHaveLength(1);
  });
});

describe("termToCrowdinPayload", () => {
  it("maps translatable term", () => {
    const payload = termToCrowdinPayload({
      term: "system",
      type: "translatable",
      notes: "A collective.",
      pos: "noun",
    });
    expect(payload.text).toBe("system");
    expect(payload.isDoNotTranslate).toBe(false);
    expect(payload.description).toContain("A collective.");
    expect(payload.partOfSpeech).toBe("noun");
  });

  it("marks do-not-translate term", () => {
    const payload = termToCrowdinPayload({
      term: "Pluralscape",
      type: "do-not-translate",
      notes: "Brand name.",
    });
    expect(payload.isDoNotTranslate).toBe(true);
  });

  it("marks negative term with AVOID prefix", () => {
    const payload = termToCrowdinPayload({
      term: "personalities",
      type: "negative",
      notes: "Harmful term.",
    });
    expect(payload.isDoNotTranslate).toBe(true);
    expect(payload.description).toMatch(/^AVOID/);
  });

  it("prepends hazard marker for critical terms", () => {
    const payload = termToCrowdinPayload({
      term: "host",
      type: "translatable",
      notes: "The primary occupant.",
      hazard: "critical",
    });
    expect(payload.description).toMatch(/^\[HAZARD: critical\]/);
  });

  it("prepends loanword marker when loanword_ok", () => {
    const payload = termToCrowdinPayload({
      term: "fictive",
      type: "translatable",
      notes: "A fictional introject.",
      loanword_ok: true,
    });
    expect(payload.description).toMatch(/\[LOANWORD OK\]/);
  });
});

describe("termToCrowdinPayload — pos mapping", () => {
  it("maps 'adj' to the SDK's adjective enum value", () => {
    const payload = termToCrowdinPayload({
      term: "x",
      type: "translatable",
      pos: "adj",
      notes: "n",
    });
    expect(payload.partOfSpeech).toBe("adjective");
  });

  it("maps compound 'noun/verb' to 'noun' (first component)", () => {
    const payload = termToCrowdinPayload({
      term: "x",
      type: "translatable",
      pos: "noun/verb",
      notes: "n",
    });
    expect(payload.partOfSpeech).toBe("noun");
  });

  it("returns undefined partOfSpeech when pos is absent", () => {
    const payload = termToCrowdinPayload({
      term: "x",
      type: "translatable",
      notes: "n",
    });
    expect(payload.partOfSpeech).toBeUndefined();
  });
});

describe("applyGlossary — error aggregation", () => {
  it("continues past individual add failures and aggregates errors into AggregateError", async () => {
    const addTerm = vi
      .fn()
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("third fail"));
    const client = {
      glossariesApi: {
        listGlossaries: vi.fn().mockResolvedValue({
          data: [{ data: { id: 1, name: "Pluralscape Terminology" } }],
        }),
        listTerms: vi.fn().mockResolvedValue({ data: [] }),
        addGlossary: vi.fn(),
        addTerm,
        editTerm: vi.fn(),
        deleteTerm: vi.fn(),
      },
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
      },
    };

    const localTerms: GlossaryTerm[] = [
      { term: "a", type: "translatable", notes: "n" },
      { term: "b", type: "translatable", notes: "n" },
      { term: "c", type: "translatable", notes: "n" },
    ];

    // CrowdinClient's full SDK types pull in ~50 transitive types that are
    // awkward to mock. The structural shape we actually use (listGlossaries,
    // listTerms, addTerm, editTerm, deleteTerm, projectsGroupsApi.editProject)
    // is fully exercised by the stub above; the cast is test-only and safe.
    await expect(
      applyGlossary(client as unknown as CrowdinClient, 100, localTerms),
    ).rejects.toThrow(AggregateError);
    expect(addTerm).toHaveBeenCalledTimes(3);
  });

  it("continues past individual update failures", async () => {
    const editTerm = vi
      .fn()
      .mockRejectedValueOnce(new Error("edit fail"))
      .mockResolvedValueOnce({});
    const client = {
      glossariesApi: {
        listGlossaries: vi.fn().mockResolvedValue({
          data: [{ data: { id: 1, name: "Pluralscape Terminology" } }],
        }),
        listTerms: vi.fn().mockResolvedValue({
          data: [
            {
              data: {
                id: 10,
                text: "a",
                description: "old",
                status: "preferred",
                partOfSpeech: "noun",
              },
            },
            {
              data: {
                id: 11,
                text: "b",
                description: "old",
                status: "preferred",
                partOfSpeech: "noun",
              },
            },
          ],
        }),
        addGlossary: vi.fn(),
        addTerm: vi.fn(),
        editTerm,
        deleteTerm: vi.fn(),
      },
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
      },
    };

    const localTerms: GlossaryTerm[] = [
      { term: "a", type: "translatable", pos: "noun", notes: "new description" },
      { term: "b", type: "translatable", pos: "noun", notes: "new description" },
    ];

    // CrowdinClient's full SDK types pull in ~50 transitive types that are
    // awkward to mock. The structural shape we actually use (listGlossaries,
    // listTerms, addTerm, editTerm, deleteTerm, projectsGroupsApi.editProject)
    // is fully exercised by the stub above; the cast is test-only and safe.
    await expect(
      applyGlossary(client as unknown as CrowdinClient, 100, localTerms),
    ).rejects.toThrow(AggregateError);
    expect(editTerm).toHaveBeenCalledTimes(2);
  });
});
