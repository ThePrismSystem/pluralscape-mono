import { I18nManager } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  I18nManager: {
    allowRTL: vi.fn(),
    forceRTL: vi.fn(),
  },
}));

import { applyLayoutDirection } from "../rtl.js";

import type { Locale } from "@pluralscape/types";

const mockAllowRTL = vi.mocked(I18nManager.allowRTL);
const mockForceRTL = vi.mocked(I18nManager.forceRTL);

describe("applyLayoutDirection", () => {
  it("calls forceRTL(true) for Arabic", () => {
    const ar: Locale = "ar";
    applyLayoutDirection(ar);
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(false) for English", () => {
    const en: Locale = "en";
    applyLayoutDirection(en);
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });

  it("calls forceRTL(false) for French", () => {
    const fr: Locale = "fr";
    applyLayoutDirection(fr);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });

  it("calls forceRTL(false) for Japanese", () => {
    const ja: Locale = "ja";
    applyLayoutDirection(ja);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });

  it("calls forceRTL(false) for simplified Chinese", () => {
    const zh: Locale = "zh-Hans";
    applyLayoutDirection(zh);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });
});
