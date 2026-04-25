/**
 * @internal — symbol is exported only so sibling type-level helpers
 * (`Serialize<T>` in `type-assertions.ts`) can structurally pattern-match
 * the marker. Not for direct consumption.
 */
export declare const __serverInternal: unique symbol;

/**
 * Marks a field on a `*ServerMetadata` type as server-fill-only — it is not
 * supplied by the client, not part of the encrypted payload, and must not
 * leak onto the wire. `EncryptedWire<T>` strips all `ServerInternal<…>`-marked
 * fields automatically.
 *
 * Example: `FrontingComment.sessionStartTime` (denormalized partition-FK per
 * ADR-019).
 */
export type ServerInternal<T> = T & { readonly [__serverInternal]: true };
