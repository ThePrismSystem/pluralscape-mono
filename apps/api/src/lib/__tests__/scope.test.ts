import { describe, expect, it } from "vitest";

import { hasScope } from "../scope.js";

import type { ApiKeyAuthContext, SessionAuthContext } from "../auth-context.js";
import type { ApiKeyScope } from "@pluralscape/types";

const sessionAuth: SessionAuthContext = {
  authMethod: "session",
  accountId: "acc_test" as SessionAuthContext["accountId"],
  systemId: "sys_test" as SessionAuthContext["systemId"],
  accountType: "system",
  ownedSystemIds: new Set(["sys_test" as SessionAuthContext["systemId"] & string]),
  auditLogIpTracking: false,
  sessionId: "ses_test" as SessionAuthContext["sessionId"],
};

function apiKeyAuth(scopes: readonly ApiKeyScope[]): ApiKeyAuthContext {
  return {
    authMethod: "apiKey",
    accountId: "acc_test" as ApiKeyAuthContext["accountId"],
    systemId: "sys_test" as ApiKeyAuthContext["systemId"],
    accountType: "system",
    ownedSystemIds: new Set(["sys_test" as ApiKeyAuthContext["systemId"] & string]),
    auditLogIpTracking: false,
    keyId: "ak_test" as ApiKeyAuthContext["keyId"],
    apiKeyScopes: scopes,
  };
}

describe("hasScope", () => {
  describe("session auth bypass", () => {
    it("returns true for any required scope", () => {
      expect(hasScope(sessionAuth, "read:members")).toBe(true);
      expect(hasScope(sessionAuth, "write:groups")).toBe(true);
      expect(hasScope(sessionAuth, "delete:fronting")).toBe(true);
      expect(hasScope(sessionAuth, "full")).toBe(true);
    });
  });

  describe("full scope", () => {
    it("grants access to any required scope", () => {
      const auth = apiKeyAuth(["full"]);
      expect(hasScope(auth, "read:members")).toBe(true);
      expect(hasScope(auth, "write:groups")).toBe(true);
      expect(hasScope(auth, "delete:fronting")).toBe(true);
      expect(hasScope(auth, "full")).toBe(true);
    });
  });

  describe("exact scope match", () => {
    it("read:members grants read:members", () => {
      expect(hasScope(apiKeyAuth(["read:members"]), "read:members")).toBe(true);
    });

    it("write:groups grants write:groups", () => {
      expect(hasScope(apiKeyAuth(["write:groups"]), "write:groups")).toBe(true);
    });

    it("delete:fronting grants delete:fronting", () => {
      expect(hasScope(apiKeyAuth(["delete:fronting"]), "delete:fronting")).toBe(true);
    });
  });

  describe("write implies read", () => {
    it("write:members grants read:members", () => {
      expect(hasScope(apiKeyAuth(["write:members"]), "read:members")).toBe(true);
    });

    it("write:members does NOT grant delete:members", () => {
      expect(hasScope(apiKeyAuth(["write:members"]), "delete:members")).toBe(false);
    });
  });

  describe("delete implies write and read", () => {
    it("delete:members grants write:members", () => {
      expect(hasScope(apiKeyAuth(["delete:members"]), "write:members")).toBe(true);
    });

    it("delete:members grants read:members", () => {
      expect(hasScope(apiKeyAuth(["delete:members"]), "read:members")).toBe(true);
    });
  });

  describe("read does NOT imply write or delete", () => {
    it("read:members does not grant write:members", () => {
      expect(hasScope(apiKeyAuth(["read:members"]), "write:members")).toBe(false);
    });

    it("read:members does not grant delete:members", () => {
      expect(hasScope(apiKeyAuth(["read:members"]), "delete:members")).toBe(false);
    });
  });

  describe("cross-domain isolation", () => {
    it("read:members does not grant read:groups", () => {
      expect(hasScope(apiKeyAuth(["read:members"]), "read:groups")).toBe(false);
    });

    it("write:fronting does not grant write:system", () => {
      expect(hasScope(apiKeyAuth(["write:fronting"]), "write:system")).toBe(false);
    });

    it("delete:blobs does not grant delete:notes", () => {
      expect(hasScope(apiKeyAuth(["delete:blobs"]), "delete:notes")).toBe(false);
    });
  });

  describe("aggregate scopes", () => {
    describe("read-all", () => {
      const auth = apiKeyAuth(["read-all"]);

      it("grants read on any domain", () => {
        expect(hasScope(auth, "read:members")).toBe(true);
        expect(hasScope(auth, "read:groups")).toBe(true);
        expect(hasScope(auth, "read:fronting")).toBe(true);
        expect(hasScope(auth, "read:audit-log")).toBe(true);
      });

      it("denies write on any domain", () => {
        expect(hasScope(auth, "write:members")).toBe(false);
        expect(hasScope(auth, "write:groups")).toBe(false);
      });

      it("denies delete on any domain", () => {
        expect(hasScope(auth, "delete:members")).toBe(false);
      });

      it("denies full", () => {
        expect(hasScope(auth, "full")).toBe(false);
      });
    });

    describe("write-all", () => {
      const auth = apiKeyAuth(["write-all"]);

      it("grants write on any domain", () => {
        expect(hasScope(auth, "write:members")).toBe(true);
        expect(hasScope(auth, "write:groups")).toBe(true);
      });

      it("grants read on any domain (write implies read)", () => {
        expect(hasScope(auth, "read:members")).toBe(true);
        expect(hasScope(auth, "read:fronting")).toBe(true);
      });

      it("denies delete on any domain", () => {
        expect(hasScope(auth, "delete:members")).toBe(false);
        expect(hasScope(auth, "delete:groups")).toBe(false);
      });

      it("denies full", () => {
        expect(hasScope(auth, "full")).toBe(false);
      });
    });

    describe("delete-all", () => {
      const auth = apiKeyAuth(["delete-all"]);

      it("grants delete on any domain", () => {
        expect(hasScope(auth, "delete:members")).toBe(true);
        expect(hasScope(auth, "delete:groups")).toBe(true);
      });

      it("grants write on any domain (delete implies write)", () => {
        expect(hasScope(auth, "write:members")).toBe(true);
        expect(hasScope(auth, "write:fronting")).toBe(true);
      });

      it("grants read on any domain (delete implies read)", () => {
        expect(hasScope(auth, "read:members")).toBe(true);
        expect(hasScope(auth, "read:groups")).toBe(true);
      });

      it("denies full", () => {
        expect(hasScope(auth, "full")).toBe(false);
      });
    });
  });

  describe("full required scope", () => {
    it("only full satisfies full", () => {
      expect(hasScope(apiKeyAuth(["full"]), "full")).toBe(true);
    });

    it("delete-all does not satisfy full", () => {
      expect(hasScope(apiKeyAuth(["delete-all"]), "full")).toBe(false);
    });

    it("combined aggregates do not satisfy full", () => {
      expect(hasScope(apiKeyAuth(["read-all", "write-all", "delete-all"]), "full")).toBe(false);
    });
  });

  describe("empty scopes", () => {
    const auth = apiKeyAuth([]);

    it("denies all required scopes", () => {
      expect(hasScope(auth, "read:members")).toBe(false);
      expect(hasScope(auth, "write:members")).toBe(false);
      expect(hasScope(auth, "delete:members")).toBe(false);
      expect(hasScope(auth, "full")).toBe(false);
    });
  });

  describe("multiple scopes", () => {
    it("checks all scopes in the array", () => {
      const auth = apiKeyAuth(["read:members", "write:groups"]);
      expect(hasScope(auth, "read:members")).toBe(true);
      expect(hasScope(auth, "write:groups")).toBe(true);
      expect(hasScope(auth, "read:groups")).toBe(true); // write implies read
      expect(hasScope(auth, "write:members")).toBe(false); // only read:members
      expect(hasScope(auth, "delete:groups")).toBe(false); // only write:groups
    });
  });
});
