import type { SecureKeyStorage } from "@pluralscape/crypto";

const BIOMETRIC_KEY_ID = "biometric-master-key";

export class BiometricKeyStore {
  private readonly storage: SecureKeyStorage;

  constructor(storage: SecureKeyStorage) {
    this.storage = storage;
  }

  async enroll(wrappedMasterKey: Uint8Array): Promise<void> {
    await this.storage.store(BIOMETRIC_KEY_ID, wrappedMasterKey, {
      requireBiometric: true,
      accessibility: "whenUnlocked",
    });
  }

  async retrieve(): Promise<Uint8Array | null> {
    return this.storage.retrieve(BIOMETRIC_KEY_ID);
  }

  async unenroll(): Promise<void> {
    await this.storage.delete(BIOMETRIC_KEY_ID);
  }
}
