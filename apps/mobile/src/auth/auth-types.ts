import type { KdfMasterKey, PwhashSalt, SignKeypair, BoxKeypair } from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

export type AuthState = "unauthenticated" | "locked" | "unlocked";

export interface AuthCredentials {
  readonly sessionToken: string;
  readonly accountId: AccountId;
  readonly systemId: SystemId;
  readonly salt: PwhashSalt;
}

export interface AuthSession {
  readonly credentials: AuthCredentials;
  readonly masterKey: KdfMasterKey;
  readonly identityKeys: { readonly sign: SignKeypair; readonly box: BoxKeypair };
}

export type AuthStateSnapshot =
  | { readonly state: "unauthenticated"; readonly session: null; readonly credentials: null }
  | { readonly state: "locked"; readonly session: null; readonly credentials: AuthCredentials }
  | {
      readonly state: "unlocked";
      readonly session: AuthSession;
      readonly credentials: AuthCredentials;
    };

export type AuthEvent =
  | {
      type: "LOGIN";
      credentials: AuthCredentials;
      masterKey: KdfMasterKey;
      identityKeys: AuthSession["identityKeys"];
    }
  | { type: "LOCK" }
  | { type: "UNLOCK"; masterKey: KdfMasterKey; identityKeys: AuthSession["identityKeys"] }
  | { type: "LOGOUT" };

export type AuthListener = (snapshot: AuthStateSnapshot) => void;
