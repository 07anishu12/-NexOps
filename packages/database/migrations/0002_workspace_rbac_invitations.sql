ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'developer';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'operator';--> statement-breakpoint
ALTER TABLE "public"."workspace_invitations" ADD COLUMN IF NOT EXISTS "role" "public"."user_role" NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE "public"."workspaces" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) NOT NULL DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "public"."workspaces" ADD COLUMN IF NOT EXISTS "locale" varchar(20) NOT NULL DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "public"."workspaces" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "public"."workspaces" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "public"."workspaces" ADD COLUMN IF NOT EXISTS "onboarding_intent" jsonb NOT NULL DEFAULT '{}'::jsonb;
