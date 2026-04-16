import { expect, test } from "@playwright/test";

import "./harness-types.js";

/**
 * Persist a snapshot, reload the page, re-init the harness, and confirm the
 * stored ciphertext survives. This proves that the OPFS storage adapter is
 * actually writing through to OPFS and not just to in-memory state.
 */
test("snapshot survives a page reload", async ({ page }) => {
  const documentId = `doc_persist_${String(Date.now())}_${String(Math.floor(Math.random() * 1e6))}`;
  const ciphertextBytes = [10, 20, 30, 40, 50, 60, 70, 80] as const;

  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  await page.evaluate(
    async ({ docId, cipherSeed }) => {
      const h = window.__harness;
      const sizes = window.__harnessByteSizes;
      if (h === undefined || sizes === undefined) throw new Error("harness missing");
      await h.init();
      const ciphertext = new Uint8Array(cipherSeed);
      const nonce = new Uint8Array(sizes.aeadNonce);
      for (let i = 0; i < nonce.length; i++) nonce[i] = i & 0xff;
      const signature = new Uint8Array(sizes.signature);
      for (let i = 0; i < signature.length; i++) signature[i] = (i * 3) & 0xff;
      const authorPublicKey = new Uint8Array(sizes.signPublicKey);
      for (let i = 0; i < authorPublicKey.length; i++) authorPublicKey[i] = (i * 5) & 0xff;
      await h.saveSnapshot(docId, {
        snapshotVersion: 1,
        ciphertext,
        nonce,
        signature,
        authorPublicKey,
      });
    },
    { docId: documentId, cipherSeed: [...ciphertextBytes] },
  );

  await page.reload();
  await page.waitForFunction(() => window.__harness !== undefined);

  const loaded = await page.evaluate(async (docId: string) => {
    const h = window.__harness;
    if (h === undefined) throw new Error("harness missing");
    await h.init();
    const snap = await h.loadSnapshot(docId);
    if (snap === null) return null;
    return {
      snapshotVersion: snap.snapshotVersion,
      ciphertext: Array.from(snap.ciphertext),
    };
  }, documentId);

  expect(loaded).not.toBeNull();
  expect(loaded?.snapshotVersion).toBe(1);
  expect(loaded?.ciphertext).toEqual([...ciphertextBytes]);

  // Cleanup so subsequent runs in the same OPFS volume start from a clean slate.
  await page.evaluate(async (docId: string) => {
    const h = window.__harness;
    if (h === undefined) return;
    await h.deleteDocument(docId);
  }, documentId);
});
