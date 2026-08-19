ALTER TABLE "build_run" ADD COLUMN "started_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "build_run" ADD CONSTRAINT "build_run_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;