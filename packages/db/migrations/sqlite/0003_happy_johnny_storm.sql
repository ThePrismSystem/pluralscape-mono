ALTER TABLE `sessions` ADD `token_hash` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);