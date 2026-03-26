ALTER TABLE "messages" DROP CONSTRAINT "messages_id_unique";--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_voter_not_null" CHECK ("poll_votes"."voter" IS NOT NULL);