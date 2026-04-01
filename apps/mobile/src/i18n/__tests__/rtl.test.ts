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
    applyLayoutDirection("ar" as Locale);
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(false) for English", () => {
    applyLayoutDirection("en" as Locale);
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });

  it("calls forceRTL(true) for Hebrew", () => {
    applyLayoutDirection("he" as Locale);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(true) for Arabic with region tag", () => {
    applyLayoutDirection("ar-SA" as Locale);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(false) for French", () => {
    applyLayoutDirection("fr" as Locale);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });
});
