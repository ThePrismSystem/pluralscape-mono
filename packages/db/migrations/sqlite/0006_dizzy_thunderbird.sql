ALTER TABLE `check_in_records` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `check_in_records_idempotency_key_unique` ON `check_in_records` (`idempotency_key`);