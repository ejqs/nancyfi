CREATE TABLE "budget_invite" (
	"id" text PRIMARY KEY,
	"budget_id" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'contributor' NOT NULL,
	"status" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "budget_invite_token_uidx" ON "budget_invite" ("token");--> statement-breakpoint
CREATE INDEX "budget_invite_budgetId_idx" ON "budget_invite" ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_invite_email_idx" ON "budget_invite" ("email");--> statement-breakpoint
CREATE INDEX "budget_invite_status_idx" ON "budget_invite" ("status");--> statement-breakpoint
ALTER TABLE "budget_invite" ADD CONSTRAINT "budget_invite_budget_id_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budget"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budget_invite" ADD CONSTRAINT "budget_invite_invited_by_user_id_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budget_invite" ADD CONSTRAINT "budget_invite_accepted_by_user_id_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;