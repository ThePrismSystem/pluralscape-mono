import { describe, expect, it } from "vitest";

import {
  AVATAR_CONCURRENCY,
  AVATAR_MAX_BYTES,
  AVATAR_REQUEST_TIMEOUT_MS,
  IMPORT_PROGRESS_POLL_INTERVAL_MS,
  PERSISTER_REF_BATCH_SIZE,
  SP_TOKEN_KEY_PREFIX,
} from "../import-sp-mobile.constants.js";

describe("import-sp-mobile.constants", () => {
  it("exports PERSISTER_REF_BATCH_SIZE as 50", () => {
    expect(PERSISTER_REF_BATCH_SIZE).toBe(50);
  });

  it("exports AVATAR_CONCURRENCY as 4", () => {
    expect(AVATAR_CONCURRENCY).toBe(4);
  });

  it("exports AVATAR_REQUEST_TIMEOUT_MS as 30_000", () => {
    expect(AVATAR_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it("exports AVATAR_MAX_BYTES as 5_000_000", () => {
    expect(AVATAR_MAX_BYTES).toBe(5_000_000);
  });

  it("exports IMPORT_PROGRESS_POLL_INTERVAL_MS as 1_500", () => {
    expect(IMPORT_PROGRESS_POLL_INTERVAL_MS).toBe(1_500);
  });

  it("exports SP_TOKEN_KEY_PREFIX as the pluralscape namespace prefix", () => {
    expect(SP_TOKEN_KEY_PREFIX).toBe("pluralscape_sp_token_");
  });
});
