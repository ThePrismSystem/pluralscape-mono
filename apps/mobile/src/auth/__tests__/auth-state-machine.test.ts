import { describe, expect, it, vi } from "vitest";

import { AuthStateMachine } from "../auth-state-machine.js";

import type { AuthCredentials, AuthSession, AuthStateSnapshot } from "../auth-types.js";
import type {
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  PwhashSalt,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

const fakeCredentials: AuthCredentials = {
  sessionToken: "tok-abc",
  accountId: "acct_123" as AccountId,
  systemId: "sys_456" as SystemId,
  salt: new Uint8Array(16) as PwhashSalt,
};

const fakeMasterKey = new Uint8Array(32) as KdfMasterKey;

const fakeIdentityKeys: AuthSession["identityKeys"] = {
  sign: {
    publicKey: new Uint8Array(32) as SignPublicKey,
    secretKey: new Uint8Array(64) as SignSecretKey,
  },
  box: {
    publicKey: new Uint8Array(32) as BoxPublicKey,
    secretKey: new Uint8Array(32) as BoxSecretKey,
  },
};

describe("AuthStateMachine", () => {
  it("starts in unauthenticated state", () => {
    const machine = new AuthStateMachine();
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("unauthenticated");
    expect(snapshot.session).toBeNull();
    expect(snapshot.credentials).toBeNull();
  });

  it("transitions to unlocked on LOGIN", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("unlocked");
    expect(snapshot.credentials).toBe(fakeCredentials);
    expect(snapshot.session?.masterKey).toBe(fakeMasterKey);
    expect(snapshot.session?.identityKeys).toBe(fakeIdentityKeys);
  });

  it("transitions to locked on LOCK from unlocked", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    machine.dispatch({ type: "LOCK" });
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("locked");
    expect(snapshot.credentials).toBe(fakeCredentials);
    expect(snapshot.session).toBeNull();
  });

  it("transitions to unlocked on UNLOCK from locked", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    machine.dispatch({ type: "LOCK" });

    const newMasterKey = new Uint8Array(32) as KdfMasterKey;
    machine.dispatch({
      type: "UNLOCK",
      masterKey: newMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("unlocked");
    expect(snapshot.session?.masterKey).toBe(newMasterKey);
    expect(snapshot.credentials).toBe(fakeCredentials);
  });

  it("transitions to unauthenticated on LOGOUT from unlocked", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    machine.dispatch({ type: "LOGOUT" });
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("unauthenticated");
    expect(snapshot.session).toBeNull();
    expect(snapshot.credentials).toBeNull();
  });

  it("transitions to unauthenticated on LOGOUT from locked", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    machine.dispatch({ type: "LOCK" });
    machine.dispatch({ type: "LOGOUT" });
    const snapshot = machine.getSnapshot();
    expect(snapshot.state).toBe("unauthenticated");
  });

  it("notifies listeners on state change", () => {
    const machine = new AuthStateMachine();
    const listener = vi.fn();
    machine.subscribe(listener);
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    expect(listener).toHaveBeenCalledOnce();
    const firstCallArgs = listener.mock.calls[0] as [AuthStateSnapshot];
    expect(firstCallArgs[0].state).toBe("unlocked");
  });

  it("unsubscribe stops notifications", () => {
    const machine = new AuthStateMachine();
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);
    unsubscribe();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores LOCK when unauthenticated (no state change)", () => {
    const machine = new AuthStateMachine();
    const before = machine.getSnapshot();
    machine.dispatch({ type: "LOCK" });
    const after = machine.getSnapshot();
    expect(after).toBe(before);
    expect(after.state).toBe("unauthenticated");
  });

  it("ignores UNLOCK when unauthenticated (no state change)", () => {
    const machine = new AuthStateMachine();
    const before = machine.getSnapshot();
    machine.dispatch({
      type: "UNLOCK",
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const after = machine.getSnapshot();
    expect(after).toBe(before);
    expect(after.state).toBe("unauthenticated");
  });

  it("ignores LOGIN when already unlocked (no state change)", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const before = machine.getSnapshot();
    machine.dispatch({
      type: "LOGIN",
      credentials: {
        sessionToken: "tok-other",
        accountId: "acct_other" as AccountId,
        systemId: "sys_other" as SystemId,
        salt: new Uint8Array(16) as PwhashSalt,
      },
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const after = machine.getSnapshot();
    expect(after).toBe(before);
    expect(after.credentials?.sessionToken).toBe("tok-abc");
  });

  it("ignores LOGIN when locked (no state change)", () => {
    const machine = new AuthStateMachine();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    machine.dispatch({ type: "LOCK" });
    const before = machine.getSnapshot();
    machine.dispatch({
      type: "LOGIN",
      credentials: {
        sessionToken: "tok-other",
        accountId: "acct_other" as AccountId,
        systemId: "sys_other" as SystemId,
        salt: new Uint8Array(16) as PwhashSalt,
      },
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const after = machine.getSnapshot();
    expect(after).toBe(before);
    expect(after.state).toBe("locked");
  });

  it("snapshot is referentially stable when no state change occurs", () => {
    const machine = new AuthStateMachine();
    const s1 = machine.getSnapshot();
    const s2 = machine.getSnapshot();
    expect(s1).toBe(s2);
  });

  it("snapshot object changes after dispatch", () => {
    const machine = new AuthStateMachine();
    const before = machine.getSnapshot();
    machine.dispatch({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    const after = machine.getSnapshot();
    expect(after).not.toBe(before);
  });

  describe("onKeyDiscard", () => {
    it("calls onKeyDiscard with masterKey on LOCK from unlocked", () => {
      const onKeyDiscard = vi.fn();
      const machine = new AuthStateMachine({ onKeyDiscard });
      machine.dispatch({
        type: "LOGIN",
        credentials: fakeCredentials,
        masterKey: fakeMasterKey,
        identityKeys: fakeIdentityKeys,
      });

      machine.dispatch({ type: "LOCK" });
      expect(onKeyDiscard).toHaveBeenCalledOnce();
      expect(onKeyDiscard).toHaveBeenCalledWith(fakeMasterKey);
    });

    it("calls onKeyDiscard with masterKey on LOGOUT from unlocked", () => {
      const onKeyDiscard = vi.fn();
      const machine = new AuthStateMachine({ onKeyDiscard });
      machine.dispatch({
        type: "LOGIN",
        credentials: fakeCredentials,
        masterKey: fakeMasterKey,
        identityKeys: fakeIdentityKeys,
      });

      machine.dispatch({ type: "LOGOUT" });
      expect(onKeyDiscard).toHaveBeenCalledOnce();
      expect(onKeyDiscard).toHaveBeenCalledWith(fakeMasterKey);
    });

    it("does NOT call onKeyDiscard on LOGOUT from locked state", () => {
      const onKeyDiscard = vi.fn();
      const machine = new AuthStateMachine({ onKeyDiscard });
      machine.dispatch({
        type: "LOGIN",
        credentials: fakeCredentials,
        masterKey: fakeMasterKey,
        identityKeys: fakeIdentityKeys,
      });
      machine.dispatch({ type: "LOCK" });
      onKeyDiscard.mockClear();

      machine.dispatch({ type: "LOGOUT" });
      expect(onKeyDiscard).not.toHaveBeenCalled();
    });

    it("works without callback (backwards compatible)", () => {
      const machine = new AuthStateMachine();
      machine.dispatch({
        type: "LOGIN",
        credentials: fakeCredentials,
        masterKey: fakeMasterKey,
        identityKeys: fakeIdentityKeys,
      });

      expect(() => {
        machine.dispatch({ type: "LOCK" });
      }).not.toThrow();
      expect(machine.getSnapshot().state).toBe("locked");
    });
  });
});
