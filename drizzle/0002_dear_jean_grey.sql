ALTER TABLE "agentConfig" ADD COLUMN "e2bSandboxId" varchar;--> statement-breakpoint
ALTER TABLE "agentConfig" ADD COLUMN "e2bSandboxStatus" varchar(32) DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "agentConfig" ADD COLUMN "e2b_last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agentConfig" ADD COLUMN "e2b_paused_at" timestamp with time zone;