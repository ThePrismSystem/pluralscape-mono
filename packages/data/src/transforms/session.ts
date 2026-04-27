import { DeviceInfoSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { DeviceInfo } from "@pluralscape/types";

/**
 * Decrypt a base64-encoded T1 blob carrying a `DeviceInfo` plaintext.
 *
 * `Session` is a Class C entity whose domain shape carries no encrypted
 * fields; the auxiliary `DeviceInfo` type is what travels inside the T1
 * blob. Clients call this when displaying their own session list.
 */
export function decryptDeviceInfo(encryptedData: string, masterKey: KdfMasterKey): DeviceInfo {
  const decrypted = decodeAndDecryptT1(encryptedData, masterKey);
  return DeviceInfoSchema.parse(decrypted);
}
