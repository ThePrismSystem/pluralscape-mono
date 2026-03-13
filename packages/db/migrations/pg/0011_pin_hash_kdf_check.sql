ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_pin_hash_kdf_check" CHECK (pin_hash IS NULL OR pin_hash LIKE '$argon2id$%');
