ALTER TABLE "build_run" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "base_sha" text;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "pr_number" integer;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "pr_state" text;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "pr_checks" text;--> statement-breakpoint
ALTER TABLE "build_run" ADD COLUMN "pr_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "build_run" ADD CONSTRAINT "build_run_parent_run_id_build_run_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."build_run"("id") ON DELETE set null ON UPDATE no action;