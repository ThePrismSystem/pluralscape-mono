import { z } from "zod/v4";

import {
  AUTH_KEY_BYTE_LENGTH,
  CHALLENGE_SIGNATURE_BYTE_LENGTH,
  ENCRYPTED_BLOB_MIN_BYTE_LENGTH,
  KDF_SALT_BYTE_LENGTH,
  PUBLIC_KEY_BYTE_LENGTH,
  RECOVERY_KEY_HASH_BYTE_LENGTH,
} from "./validation.constants.js";

/** Hex-encoded binary field of exact byte length. */
const hexBytes = (byteLen: number) =>
  z
    .string()
    .regex(/^[0-9a-f]+$/i)
    .length(byteLen * 2);

const authKeyHex = hexBytes(AUTH_KEY_BYTE_LENGTH);
const kdfSaltHex = hexBytes(KDF_SALT_BYTE_LENGTH);
const challengeSigHex = hexBytes(CHALLENGE_SIGNATURE_BYTE_LENGTH);
const recoveryKeyHashHex = hexBytes(RECOVERY_KEY_HASH_BYTE_LENGTH);

/** Hex-encoded encrypted blob: at least nonce (24B) + tag (16B) = 40 bytes. */
const encryptedBlobHex = z
  .string()
  .regex(/^[0-9a-f]+$/i)
  .min(ENCRYPTED_BLOB_MIN_BYTE_LENGTH * 2);

const publicKeyHex = hexBytes(PUBLIC_KEY_BYTE_LENGTH);

/** Phase 1: client sends email to initiate registration. */
export const RegistrationInitiateSchema = z
  .object({
    email: z.email(),
    accountType: z.enum(["system", "viewer"]).default("system"),
  })
  .readonly();

/** Phase 2: client sends all encrypted blobs + auth key. */
export const RegistrationCommitSchema = z
  .object({
    accountId: z.string().startsWith("acct_"),
    authKey: authKeyHex,
    encryptedMasterKey: encryptedBlobHex,
    encryptedSigningPrivateKey: encryptedBlobHex,
    encryptedEncryptionPrivateKey: encryptedBlobHex,
    publicSigningKey: publicKeyHex,
    publicEncryptionKey: publicKeyHex,
    recoveryEncryptedMasterKey: encryptedBlobHex,
    challengeSignature: challengeSigHex,
    recoveryKeyBackupConfirmed: z.boolean(),
    recoveryKeyHash: recoveryKeyHashHex,
  })
  .readonly();

/** Salt fetch — client sends email to get KDF salt. */
export const SaltFetchSchema = z
  .object({
    email: z.email(),
  })
  .readonly();

/** Login — client sends email + auth_key (hex-encoded 32 bytes). */
export const LoginSchema = z
  .object({
    email: z.email(),
    authKey: authKeyHex,
  })
  .readonly();

/** Change password — client sends new encrypted blobs. */
export const ChangePasswordSchema = z
  .object({
    oldAuthKey: authKeyHex,
    newAuthKey: authKeyHex,
    newKdfSalt: kdfSaltHex,
    newEncryptedMasterKey: encryptedBlobHex,
    challengeSignature: challengeSigHex,
  })
  .readonly();

/** Change email — requires auth key verification instead of password. */
export const ChangeEmailSchema = z
  .object({
    email: z.email(),
    authKey: authKeyHex,
  })
  .readonly();

/** Regenerate recovery key — client sends new encrypted backup. */
export const RegenerateRecoveryKeySchema = z
  .object({
    authKey: authKeyHex,
    newRecoveryEncryptedMasterKey: encryptedBlobHex,
    recoveryKeyHash: recoveryKeyHashHex,
    confirmed: z.literal(true),
  })
  .readonly();

/** Password reset via recovery key — client sends all new blobs. */
export const PasswordResetViaRecoveryKeySchema = z
  .object({
    email: z.email(),
    newAuthKey: authKeyHex,
    newKdfSalt: kdfSaltHex,
    newEncryptedMasterKey: encryptedBlobHex,
    newRecoveryEncryptedMasterKey: encryptedBlobHex,
    newRecoveryKeyHash: recoveryKeyHashHex,
  })
  .readonly();

export const UpdateAccountSettingsSchema = z
  .object({
    auditLogIpTracking: z.boolean(),
    version: z.number().int().positive(),
  })
  .readonly();
