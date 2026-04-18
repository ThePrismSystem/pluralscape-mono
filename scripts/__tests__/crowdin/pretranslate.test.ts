import { describe, expect, it } from "vitest";

import { buildPretranslateRequest } from "../../crowdin/pretranslate.js";

describe("buildPretranslateRequest", () => {
  it("defaults to all languages and TM+MT with glossary", () => {
    const req = buildPretranslateRequest({ deeplMtId: 1, googleMtId: 2 });
    expect(req.method).toBe("tm");
    expect(req.autoApproveOption).toBe("none");
    expect(req.applyUntranslatedStringsOnly).toBe(true);
    expect(req.labelIds).toEqual([]);
  });

  it("passes through file IDs when provided", () => {
    const req = buildPretranslateRequest({
      deeplMtId: 1,
      googleMtId: 2,
      fileIds: [10, 20],
    });
    expect(req.fileIds).toEqual([10, 20]);
  });

  it("scopes language IDs when provided", () => {
    const req = buildPretranslateRequest({
      deeplMtId: 1,
      googleMtId: 2,
      languageIds: ["ar"],
    });
    expect(req.languageIds).toEqual(["ar"]);
  });
});
