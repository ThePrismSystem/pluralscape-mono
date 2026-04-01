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

export interface AuthStateSnapshot {
  readonly state: AuthState;
  readonly session: AuthSession | null;
  readonly credentials: AuthCredentials | null;
}

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
