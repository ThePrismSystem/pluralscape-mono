import { expect, test } from "@playwright/test";

import "./harness-types.js";

const ONE_MIB = 1024 * 1024;

/**
 * Save a 1 MiB ciphertext snapshot then load it back and assert byte identity.
 * Catches regressions where blob bind/get paths truncate, alias, or copy
 * incorrectly through the worker postMessage boundary.
 */
test("round-trips a 1 MiB ciphertext blob byte-identically", async ({ page }) => {
  const documentId = `doc_blob_${String(Date.now())}_${String(Math.floor(Math.random() * 1e6))}`;

  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  const result = await page.evaluate(
    async ({ docId, size }) => {
      const h = window.__harness;
      const sizes = window.__harnessByteSizes;
      if (h === undefined || sizes === undefined) throw new Error("harness missing");
      await h.init();

      const ciphertext = new Uint8Array(size);
      for (let i = 0; i < size; i++) ciphertext[i] = i & 0xff;
      const nonce = new Uint8Array(sizes.aeadNonce);
      const signature = new Uint8Array(sizes.signature);
      const authorPublicKey = new Uint8Array(sizes.signPublicKey);

      await h.saveSnapshot(docId, {
        snapshotVersion: 7,
        ciphertext,
        nonce,
        signature,
        authorPublicKey,
      });
      const loaded = await h.loadSnapshot(docId);
      if (loaded === null) return { ok: false as const, reason: "loadSnapshot returned null" };

      // Compare byte-by-byte without shipping a 1 MiB array back to Node.
      if (loaded.ciphertext.byteLength !== size) {
        return {
          ok: false as const,
          reason: `length mismatch: got ${String(loaded.ciphertext.byteLength)} expected ${String(size)}`,
        };
      }
      for (let i = 0; i < size; i++) {
        if (loaded.ciphertext[i] !== (i & 0xff)) {
          return {
            ok: false as const,
            reason: `byte ${String(i)} mismatch: got ${String(loaded.ciphertext[i])}`,
          };
        }
      }
      await h.deleteDocument(docId);
      return { ok: true as const };
    },
    { docId: documentId, size: ONE_MIB },
  );

  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
});
