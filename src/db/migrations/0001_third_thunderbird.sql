CREATE TYPE "public"."work_item_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."work_item_status" AS ENUM('planning', 'ready', 'in_progress', 'in_review', 'done');--> statement-breakpoint
CREATE TABLE "prd" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"problem_statement" text,
	"goals" text,
	"in_scope" text,
	"out_of_scope" text,
	"success_criteria" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prd_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "roadmap_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"target_timeframe" text,
	"business_goal" text,
	"why" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_entry_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "spec" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_item_id" uuid NOT NULL,
	"technical_approach" text,
	"design_notes" text,
	"acceptance_criteria" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spec_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "work_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" "work_item_status" DEFAULT 'planning' NOT NULL,
	"priority" "work_item_priority" DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prd" ADD CONSTRAINT "prd_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_entry" ADD CONSTRAINT "roadmap_entry_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec" ADD CONSTRAINT "spec_work_item_id_work_item_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;