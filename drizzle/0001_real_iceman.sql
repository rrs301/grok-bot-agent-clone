CREATE TABLE "agent_chat_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"user_email" text NOT NULL,
	"timezone" varchar(128),
	"editing_routine_id" varchar,
	"latest_user_message" text,
	"agent_message" text,
	"request_messages" jsonb NOT NULL,
	"response" jsonb,
	"tool_cards" jsonb,
	"status" varchar(32) DEFAULT 'completed' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_chat_history" ADD CONSTRAINT "agent_chat_history_agent_id_agentConfig_agentId_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agentConfig"("agentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_history" ADD CONSTRAINT "agent_chat_history_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_chat_history_agent_user_unique" ON "agent_chat_history" USING btree ("agent_id","user_email");--> statement-breakpoint
CREATE INDEX "agent_chat_history_agent_updated_idx" ON "agent_chat_history" USING btree ("agent_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_chat_history_user_updated_idx" ON "agent_chat_history" USING btree ("user_email","updated_at");