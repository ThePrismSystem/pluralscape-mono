import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GlossarySchema } from "../crowdin/glossary-schema.js";

describe("GlossarySchema", () => {
  it("accepts a minimal valid glossary", () => {
    const data = {
      terms: [{ term: "system", type: "translatable", notes: "A collective." }],
    };
    expect(() => GlossarySchema.parse(data)).not.toThrow();
  });

  it("rejects unknown type values", () => {
    const data = { terms: [{ term: "x", type: "bogus", notes: "n" }] };
    expect(() => GlossarySchema.parse(data)).toThrow();
  });

  it("rejects empty term strings", () => {
    const data = { terms: [{ term: "", type: "translatable", notes: "n" }] };
    expect(() => GlossarySchema.parse(data)).toThrow();
  });

  it("rejects missing notes field", () => {
    const data = { terms: [{ term: "x", type: "translatable" }] };
    expect(() => GlossarySchema.parse(data)).toThrow();
  });

  it("rejects unknown hazard values", () => {
    const data = {
      terms: [{ term: "x", type: "translatable", notes: "n", hazard: "extreme" }],
    };
    expect(() => GlossarySchema.parse(data)).toThrow();
  });

  it("rejects duplicate term entries", () => {
    const data = {
      terms: [
        { term: "system", type: "translatable", notes: "first" },
        { term: "system", type: "translatable", notes: "second" },
      ],
    };
    expect(() => GlossarySchema.parse(data)).toThrow(/duplicate/i);
  });

  it("validates the committed glossary file", () => {
    const file = path.resolve(__dirname, "../crowdin-glossary.json");
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    expect(() => GlossarySchema.parse(parsed)).not.toThrow();
  });
});
