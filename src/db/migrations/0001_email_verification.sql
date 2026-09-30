CREATE TYPE "public"."user_status" AS ENUM('PENDING_EMAIL_VERIFICATION', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'PENDING_EMAIL_VERIFICATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_verification_token_hash_unique" UNIQUE("email_verification_token_hash");--> statement-breakpoint
-- Contas que já tinham acesso continuam liberadas (criadas antes da verificação de e-mail).
-- Cadastros ainda não aprovados precisarão confirmar o e-mail antes da aprovação.
UPDATE "users" SET "status" = 'APPROVED', "email_verified" = true, "email_verified_at" = now(), "approved_at" = now() WHERE "approved" = true AND "password_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "approved";
