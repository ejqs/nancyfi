CREATE TABLE "budget" (
	"id" text PRIMARY KEY,
	"automerge_url" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_membership" (
	"id" text PRIMARY KEY,
	"budget_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "budget_createdByUserId_idx" ON "budget" ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "budget_status_idx" ON "budget" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_automergeUrl_uidx" ON "budget" ("automerge_url");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_membership_budget_user_uidx" ON "budget_membership" ("budget_id","user_id");--> statement-breakpoint
CREATE INDEX "budget_membership_userId_idx" ON "budget_membership" ("user_id");--> statement-breakpoint
CREATE INDEX "budget_membership_budgetId_idx" ON "budget_membership" ("budget_id");--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budget_membership" ADD CONSTRAINT "budget_membership_budget_id_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budget"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budget_membership" ADD CONSTRAINT "budget_membership_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;