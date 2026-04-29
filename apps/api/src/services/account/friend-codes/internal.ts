import type { Archivable, FriendCode } from "@pluralscape/types";

/**
 * Service-layer result type for FriendCode reads.
 *
 * Aliased to `Archivable<FriendCode>` after PR #585 — the prior projection
 * mapper (`toFriendCodeResult`) became an identity function once the entity
 * adopted the discriminated `Archivable<T>` chain, so it was removed in
 * favor of pass-through. Callers receive the discriminated union directly
 * and can narrow on `archived` to access `archivedAt` on the archived
 * branch.
 */
export type FriendCodeResult = Archivable<FriendCode>;
