CREATE TABLE "agentConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentId" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"agentImage" text,
	"tools" jsonb,
	"composioSessionId" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"userEmail" text NOT NULL,
	CONSTRAINT "agentConfig_agentId_unique" UNIQUE("agentId")
);
--> statement-breakpoint
CREATE TABLE "agent_workflows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"user_email" text NOT NULL,
	"status" varchar(32) NOT NULL,
	"state" jsonb NOT NULL,
	"connection_request_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_executions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"routine_id" varchar NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"user_email" text NOT NULL,
	"name" varchar NOT NULL,
	"goal" text NOT NULL,
	"instructions" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"category" varchar(100) DEFAULT 'General',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"credits" integer DEFAULT 5,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agentConfig" ADD CONSTRAINT "agentConfig_userEmail_users_email_fk" FOREIGN KEY ("userEmail") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_agent_id_agentConfig_agentId_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agentConfig"("agentId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_executions" ADD CONSTRAINT "routine_executions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_agent_id_agentConfig_agentId_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agentConfig"("agentId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routine_executions_routine_scheduled_unique" ON "routine_executions" USING btree ("routine_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "routine_executions_status_scheduled_idx" ON "routine_executions" USING btree ("status","scheduled_for");