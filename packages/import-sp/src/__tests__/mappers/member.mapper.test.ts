import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapMember } from "../../mappers/member.mapper.js";

import type { SPMember } from "../../sources/sp-types.js";

describe("mapMember", () => {
  it("maps a minimal member", () => {
    const sp: SPMember = { _id: "m1", name: "Aria" };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.member.name).toBe("Aria");
      expect(result.payload.member.description).toBeNull();
      expect(result.payload.member.pronouns).toBeNull();
      expect(result.payload.member.avatarUrl).toBeNull();
      expect(result.payload.member.colors).toEqual([]);
      expect(result.payload.member.archived).toBe(false);
      expect(result.payload.fieldValues).toEqual([]);
    }
  });

  it("converts the SP single color to a one-entry colors array", () => {
    const sp: SPMember = { _id: "m1", name: "A", color: "#fa0" };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.member.colors).toEqual(["#fa0"]);
    }
  });

  it("preserves desc, pronouns, avatarUrl, and archived", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      desc: "hi",
      pronouns: "they/them",
      avatarUrl: "https://x/y.png",
      archived: true,
    };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.member.description).toBe("hi");
      expect(result.payload.member.pronouns).toBe("they/them");
      expect(result.payload.member.avatarUrl).toBe("https://x/y.png");
      expect(result.payload.member.archived).toBe(true);
    }
  });

  it("extracts info into field values", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      info: { fld_1: "blue", fld_2: "42" },
    };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.fieldValues).toHaveLength(2);
      expect(result.payload.fieldValues[0]?.memberSourceId).toBe("m1");
    }
  });

  it("forwards modern bucket assignments to bucketSourceIds", () => {
    const sp: SPMember = { _id: "m1", name: "A", buckets: ["bk1", "bk2"] };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["bk1", "bk2"]);
    }
  });

  it("translates legacy private:true to synthetic:private", () => {
    const sp: SPMember = { _id: "m1", name: "A", private: true };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["synthetic:private"]);
    }
  });

  it("translates legacy preventTrusted:true (not private) to public-only", () => {
    const sp: SPMember = { _id: "m1", name: "A", private: false, preventTrusted: true };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["synthetic:public"]);
    }
  });

  it("translates legacy private:false, preventTrusted:false to public + trusted", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      private: false,
      preventTrusted: false,
    };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["synthetic:public", "synthetic:trusted"]);
    }
  });

  it("fails closed to synthetic:private when no bucket info is available", () => {
    const sp: SPMember = { _id: "m1", name: "A" };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["synthetic:private"]);
    }
  });

  it("modern buckets override legacy private/preventTrusted flags", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      buckets: ["bk1"],
      private: true,
      preventTrusted: true,
    };
    const result = mapMember(sp, createMappingContext({ sourceMode: "fake" }));
    if (result.status === "mapped") {
      expect(result.payload.bucketSourceIds).toEqual(["bk1"]);
    }
  });

  it("skips members with empty names and emits a warning", () => {
    const sp: SPMember = { _id: "m1", name: "" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("member");
  });

  it("warns for dropped frame and supportDescMarkdown fields", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      frame: "vintage",
      supportDescMarkdown: true,
    };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    const messages = ctx.warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes("frame"))).toBe(true);
    expect(messages.some((m) => m.includes("supportDescMarkdown"))).toBe(true);
  });

  it("warns for dropped per-member notification toggles", () => {
    const sp: SPMember = {
      _id: "m1",
      name: "A",
      preventsFrontNotifs: true,
      receiveMessageBoardNotifs: false,
    };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapMember(sp, ctx);
    expect(result.status).toBe("mapped");
    expect(ctx.warnings.some((w) => w.message.includes("notification"))).toBe(true);
  });
});
