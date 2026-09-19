import { boolean, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  credits: integer('credits').default(5)
});

export const AgentConfig = pgTable('agentConfig', {
  id: serial('id').primaryKey(),
  agentId: varchar('agentId').notNull().unique(),
  name: varchar('name').notNull(),
  description: text('description'),
  agentImage: text('agentImage'),
  tools: jsonb('tools'),
  composioSessionId: varchar('composioSessionId'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userEmail: text('userEmail').notNull().references(() => users.email)
})

export const Tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  slug: varchar('slug').notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: varchar("category", { length: 100 }).default("General"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

//Routine Table


export const Routines = pgTable("routines", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id")
    .notNull()
    .references(() => AgentConfig.agentId),
  userEmail: text("user_email")
    .notNull()
    .references(() => users.email),

  name: varchar("name").notNull(),
  goal: text("goal").notNull(),
  instructions: text("instructions").notNull(),
  schedule: jsonb("schedule").notNull(),
  tools: jsonb("tools").notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const AgentWorkflows = pgTable("agent_workflows", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id")
    .notNull()
    .references(() => AgentConfig.agentId),
  userEmail: text("user_email")
    .notNull()
    .references(() => users.email),
  status: varchar("status", { length: 32 }).notNull(),
  state: jsonb("state").notNull(),
  connectionRequestId: varchar("connection_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
