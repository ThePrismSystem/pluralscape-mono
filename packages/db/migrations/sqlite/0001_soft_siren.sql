CREATE TABLE `biometric_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `biometric_tokens_session_id_idx` ON `biometric_tokens` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `biometric_tokens_token_hash_idx` ON `biometric_tokens` (`token_hash`);