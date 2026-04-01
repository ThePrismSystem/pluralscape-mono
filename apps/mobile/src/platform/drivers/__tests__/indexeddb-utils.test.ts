import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { idbRequest, openIdb } from "../indexeddb-utils.js";

describe("idbRequest", () => {
  it("resolves with the result on success", async () => {
    const db = await openIdb("idb-req-test", 1, (d) => {
      d.createObjectStore("store");
    });
    const tx = db.transaction("store", "readwrite");
    const store = tx.objectStore("store");
    await idbRequest(store.put("hello", "key1"));
    const result = await idbRequest(store.get("key1") as IDBRequest<string | undefined>);
    expect(result).toBe("hello");
    db.close();
  });
});

describe("openIdb", () => {
  it("opens a database and runs the upgrade callback", async () => {
    let upgradeCalled = false;
    const db = await openIdb("open-test", 1, (d) => {
      upgradeCalled = true;
      d.createObjectStore("myStore");
    });
    expect(upgradeCalled).toBe(true);
    expect(db.objectStoreNames.contains("myStore")).toBe(true);
    db.close();
  });

  it("returns the same schema on subsequent opens without re-running upgrade", async () => {
    const db1 = await openIdb("open-reopen", 1, (d) => {
      d.createObjectStore("store");
    });
    db1.close();

    let upgradeCalled = false;
    const db2 = await openIdb("open-reopen", 1, () => {
      upgradeCalled = true;
    });
    expect(upgradeCalled).toBe(false);
    expect(db2.objectStoreNames.contains("store")).toBe(true);
    db2.close();
  });

  it("rejects with an error message on failure", async () => {
    await expect(openIdb("bad-version", 0, () => {})).rejects.toThrow();
  });
});
