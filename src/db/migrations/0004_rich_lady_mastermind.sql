CREATE TYPE "public"."workspace_mode" AS ENUM('team', 'solo');--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mode" "workspace_mode" DEFAULT 'team' NOT NULL,
	"default_repository_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_repository_id_repository_id_fk" FOREIGN KEY ("default_repository_id") REFERENCES "public"."repository"("id") ON DELETE set null ON UPDATE no action;