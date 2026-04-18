import { describe, expect, it } from "vitest";

import { diffGlossaryTerms, termToCrowdinPayload } from "../../crowdin/glossary.js";
import type { GlossaryTerm } from "../../crowdin/glossary-schema.js";

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
    const remote = [{ id: 1, text: "system", description: "Old description." }];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0]?.id).toBe(1);
    expect(diff.toAdd.map((t) => t.term)).toEqual(["fronting"]);
  });

  it("removes terms no longer present locally", () => {
    const remote = [
      { id: 1, text: "system", description: "A collective." },
      { id: 2, text: "fronting", description: "Executive control." },
      { id: 99, text: "obsolete", description: "Old term." },
    ];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toRemove).toEqual([99]);
  });

  it("treats description match as unchanged", () => {
    const remote = [
      { id: 1, text: "system", description: "A collective." },
      { id: 2, text: "fronting", description: "[HAZARD: critical] Executive control." },
    ];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toAdd).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
  });

  it("case-insensitive term matching", () => {
    const remote = [{ id: 1, text: "SYSTEM", description: "A collective." }];
    const diff = diffGlossaryTerms(local, remote);
    expect(diff.toAdd.map((t) => t.term)).toEqual(["fronting"]);
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
