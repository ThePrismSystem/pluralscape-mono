import { toUnixMillis, type UnixMillis } from "@pluralscape/types";

export const fixtureNow = (): UnixMillis => toUnixMillis(Date.now());

export const fixtureNowPlus = (offsetMs: number): UnixMillis => toUnixMillis(Date.now() + offsetMs);
