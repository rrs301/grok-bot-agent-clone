
import { z } from "zod";

export const workflowOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
});

export const workflowQuestionSchema = z.object({
  id: z.string(),
  field: z.string(),
  question: z.string(),
  input: z.enum(["choice", "text", "time", "date"]),
  options: z.array(workflowOptionSchema).max(5),
  allowCustom: z.boolean(),
  placeholder: z.string().nullable(),
});

export const resourceSelectionSchema = z.object({
  toolkitSlug: z.string(),
  resourceType: z.string(),
  id: z.string(),
  label: z.string(),
});

export const routineSchema = z.object({
  name: z.string(),
  goal: z.string(),
  instructions: z.string(),
  schedule: z.object({
    startDate: z.string(),
    time: z.string(),
    timezone: z.string(),
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    weekDays: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])),
  }),
  tools: z.array(z.object({ slug: z.string(), reason: z.string() })),
  resources: z.array(resourceSelectionSchema),
  assumptions: z.array(z.string()),
});

export const agentResponseSchema = z.object({
  type: z.enum([
    "message",
    "connection_required",
    "option_selection",
    "clarification",
    "confirmation",
    "completed",
  ]),
  message: z.string(),
  question: workflowQuestionSchema.nullable(),
  integration: z.object({
    toolkitSlug: z.string(),
    reason: z.string(),
    resourceType: z.string().nullable(),
    resourceQuery: z.string().nullable(),
  }).nullable(),
  routine: routineSchema.nullable(),
});

export const workflowStateSchema = z.object({
  version: z.literal(1),
  status: z.enum(["active", "awaiting_connection", "awaiting_input", "awaiting_confirmation", "completed", "error"]),
  intent: z.string(),
  timezone: z.string(),
  values: z.record(z.string(), z.unknown()),
  assumptions: z.array(z.string()),
  selectedResources: z.array(resourceSelectionSchema),
  currentResponse: agentResponseSchema,
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
export type WorkflowOption = z.infer<typeof workflowOptionSchema>;
export type WorkflowQuestion = z.infer<typeof workflowQuestionSchema>;
export type WorkflowState = z.infer<typeof workflowStateSchema>;
