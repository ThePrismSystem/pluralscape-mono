CREATE INDEX "acknowledgements_system_archived_created_idx" ON "acknowledgements" USING btree ("system_id","archived","created_at","id");--> statement-breakpoint
CREATE INDEX "board_messages_system_archived_sort_idx" ON "board_messages" USING btree ("system_id","archived","sort_order","id");--> statement-breakpoint
CREATE INDEX "channels_parent_id_idx" ON "channels" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notes_system_archived_created_idx" ON "notes" USING btree ("system_id","archived","created_at","id");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_created_idx" ON "poll_votes" USING btree ("poll_id","created_at","id");--> statement-breakpoint
CREATE INDEX "poll_votes_voter_gin_idx" ON "poll_votes" USING gin ("voter");--> statement-breakpoint
CREATE INDEX "polls_system_archived_created_idx" ON "polls" USING btree ("system_id","archived","created_at","id");