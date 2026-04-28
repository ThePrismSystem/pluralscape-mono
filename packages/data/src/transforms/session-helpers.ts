import { decryptDeviceInfo } from "./session.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { DeviceInfo, SessionId } from "@pluralscape/types";

/** Shape of the tRPC session-list row (mirrors apps/api SessionInfo). */
export interface SessionListRow {
  readonly id: SessionId;
  readonly createdAt: number;
  readonly lastActive: number | null;
  readonly expiresAt: number | null;
  readonly encryptedData: string | null;
}

/** Same row with the DeviceInfo decoded from encryptedData. */
export interface SessionListRowWithDeviceInfo extends SessionListRow {
  readonly deviceInfo: DeviceInfo | null;
}

/**
 * Project a session-list row plus the master key into a row carrying the
 * decoded DeviceInfo. Returns deviceInfo=null when encryptedData is null
 * (legacy rows that pre-date device-info capture).
 */
export function withDecryptedDeviceInfo(
  row: SessionListRow,
  masterKey: KdfMasterKey,
): SessionListRowWithDeviceInfo {
  return {
    ...row,
    deviceInfo: row.encryptedData === null ? null : decryptDeviceInfo(row.encryptedData, masterKey),
  };
}
