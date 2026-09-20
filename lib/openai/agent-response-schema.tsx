
import { z } from "zod";

export const toolSuggestionSchema = z.object({
  slug: z.string(),
  reason: z.string(),
  description: z.string(),
  name: z.string(),
  icon: z.string(),
  isConnected: z.boolean(),
  isEnabled: z.boolean()
})

export const routineSchema = z.object({
  name: z.string(),
  goal: z.string(),

  // Generated for this routine only.
  instructions: z.string(),

  schedule: z.object({
    startDate: z.string(), // YYYY-MM-DD
    time: z.string(),      // HH:mm
    timezone: z.string(),  // America/New_York
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    weekDays: z.array(
      z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
    ),
  }),

  tools: z.array(toolSuggestionSchema),
});

export const agentResponseSchema = z.object({
  type: z.enum(["message", "clarification", "routine"]),
  message: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
  })),
  suggestedTools: z.array(toolSuggestionSchema).default([]),
  routine: routineSchema.nullable(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
export type ToolSuggestion = z.infer<typeof toolSuggestionSchema>;
