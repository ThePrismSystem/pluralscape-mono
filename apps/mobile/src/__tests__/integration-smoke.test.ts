import { createAppQueryClient } from "@pluralscape/data";
import { describe, expect, it } from "vitest";

import "fake-indexeddb/auto";
import { AuthStateMachine } from "../auth/auth-state-machine.js";
import { ConnectionStateMachine } from "../connection/connection-state-machine.js";

import type { AuthCredentials, AuthSession } from "../auth/auth-types.js";
import type {
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  PwhashSalt,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

describe("M8 Foundation Integration Smoke Test", () => {
  it("auth → connection → sync layer stack initializes correctly", () => {
    // Layer 1: Auth state machine
    const auth = new AuthStateMachine();
    expect(auth.getSnapshot().state).toBe("unauthenticated");

    // Layer 2: Connection state machine
    const conn = new ConnectionStateMachine({
      baseUrl: "http://localhost:3000",
      maxBackoffMs: 30_000,
      baseBackoffMs: 1_000,
    });
    expect(conn.getSnapshot()).toBe("disconnected");

    // Layer 3: Query client
    const qc = createAppQueryClient();
    expect(qc).toBeDefined();

    // Simulate login
    const creds: AuthCredentials = {
      sessionToken: "ps_sess_smoke",
      accountId: "acct_1" as AccountId,
      systemId: "sys_1" as SystemId,
      salt: new Uint8Array(16) as PwhashSalt,
    };
    const masterKey = new Uint8Array(32) as KdfMasterKey;
    const identityKeys: AuthSession["identityKeys"] = {
      sign: {
        publicKey: new Uint8Array(32) as SignPublicKey,
        secretKey: new Uint8Array(64) as SignSecretKey,
      },
      box: {
        publicKey: new Uint8Array(32) as BoxPublicKey,
        secretKey: new Uint8Array(32) as BoxSecretKey,
      },
    };

    auth.dispatch({ type: "LOGIN", credentials: creds, masterKey, identityKeys });
    expect(auth.getSnapshot().state).toBe("unlocked");

    // Connection responds to auth
    conn.dispatch({ type: "CONNECT", token: creds.sessionToken, systemId: "sys_1" });
    expect(conn.getSnapshot()).toBe("connecting");

    conn.dispatch({ type: "CONNECTED" });
    expect(conn.getSnapshot()).toBe("connected");

    // Lock → disconnect
    auth.dispatch({ type: "LOCK" });
    expect(auth.getSnapshot().state).toBe("locked");
    conn.dispatch({ type: "DISCONNECT" });
    expect(conn.getSnapshot()).toBe("disconnected");
  });
});
