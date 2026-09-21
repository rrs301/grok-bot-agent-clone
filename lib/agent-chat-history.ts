import { AgentChatHistory, db } from "@/db";
import { and, eq, sql } from "drizzle-orm";

type SaveAgentChatHistoryInput = {
  agentId: string;
  userEmail: string;
  messages: unknown[];
  timezone?: string | null;
  editingRoutineId?: string | null;
  response?: unknown;
  toolCards?: unknown;
  status?: "completed" | "failed";
  error?: string | null;
};

type AppendAgentChatHistoryMessageInput = {
  agentId: string;
  userEmail: string;
  content: string;
  timezone?: string | null;
  editingRoutineId?: string | null;
  response?: unknown;
  toolCards?: unknown;
  status?: "completed" | "failed";
  error?: string | null;
};

function latestTextMessage(messages: unknown[], role: "user" | "agent" | "assistant") {
  const message = [...messages]
    .reverse()
    .find((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { role?: unknown; content?: unknown };
      return candidate.role === role && typeof candidate.content === "string";
    }) as { content?: string } | undefined;

  return message?.content ?? null;
}

function asMessageArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getResponseMessage(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const message = (response as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function buildStoredMessages({
  messages,
  response,
  toolCards,
  editingRoutineId,
}: {
  messages: unknown[];
  response?: unknown;
  toolCards?: unknown;
  editingRoutineId?: string | null;
}) {
  const agentMessage = getResponseMessage(response);
  if (!agentMessage) return messages;

  return [
    ...messages,
    {
      id: crypto.randomUUID(),
      role: "agent",
      content: agentMessage,
      response,
      toolCards: toolCards ?? [],
      editingRoutineId: editingRoutineId || undefined,
      time: new Date().toISOString(),
    },
  ];
}

export async function saveAgentChatHistory({
  agentId,
  userEmail,
  messages,
  timezone,
  editingRoutineId,
  response,
  toolCards,
  status = "completed",
  error = null,
}: SaveAgentChatHistoryInput) {
  await db.delete(AgentChatHistory).where(
    sql`${AgentChatHistory.updatedAt} < now() - interval '3 days'`
  );

  const storedMessages = buildStoredMessages({
    messages,
    response,
    toolCards,
    editingRoutineId,
  });
  const now = new Date();

  await db.insert(AgentChatHistory).values({
    id: crypto.randomUUID(),
    agentId,
    userEmail,
    timezone: timezone || null,
    editingRoutineId: editingRoutineId || null,
    latestUserMessage: latestTextMessage(storedMessages, "user"),
    agentMessage: getResponseMessage(response) ?? latestTextMessage(storedMessages, "agent"),
    requestMessages: storedMessages,
    response: response ?? null,
    toolCards: toolCards ?? null,
    status,
    error,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [AgentChatHistory.agentId, AgentChatHistory.userEmail],
    set: {
      timezone: timezone || null,
      editingRoutineId: editingRoutineId || null,
      latestUserMessage: latestTextMessage(storedMessages, "user"),
      agentMessage: getResponseMessage(response) ?? latestTextMessage(storedMessages, "agent"),
      requestMessages: storedMessages,
      response: response ?? null,
      toolCards: toolCards ?? null,
      status,
      error,
      updatedAt: now,
    },
  });
}

export async function appendAgentChatHistoryMessage({
  agentId,
  userEmail,
  content,
  timezone,
  editingRoutineId,
  response,
  toolCards,
  status = "completed",
  error = null,
}: AppendAgentChatHistoryMessageInput) {
  await db.delete(AgentChatHistory).where(
    sql`${AgentChatHistory.updatedAt} < now() - interval '3 days'`
  );

  const now = new Date();
  const [history] = await db
    .select({ requestMessages: AgentChatHistory.requestMessages })
    .from(AgentChatHistory)
    .where(
      and(
        eq(AgentChatHistory.agentId, agentId),
        eq(AgentChatHistory.userEmail, userEmail)
      )
    )
    .limit(1);

  const storedMessages = [
    ...asMessageArray(history?.requestMessages),
    {
      id: crypto.randomUUID(),
      role: "agent",
      content,
      response,
      toolCards: toolCards ?? [],
      editingRoutineId: editingRoutineId || undefined,
      time: now.toISOString(),
    },
  ];

  await db.insert(AgentChatHistory).values({
    id: crypto.randomUUID(),
    agentId,
    userEmail,
    timezone: timezone || null,
    editingRoutineId: editingRoutineId || null,
    latestUserMessage: latestTextMessage(storedMessages, "user"),
    agentMessage: content,
    requestMessages: storedMessages,
    response: response ?? null,
    toolCards: toolCards ?? null,
    status,
    error,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [AgentChatHistory.agentId, AgentChatHistory.userEmail],
    set: {
      timezone: timezone || null,
      editingRoutineId: editingRoutineId || null,
      latestUserMessage: latestTextMessage(storedMessages, "user"),
      agentMessage: content,
      requestMessages: storedMessages,
      response: response ?? null,
      toolCards: toolCards ?? null,
      status,
      error,
      updatedAt: now,
    },
  });
}

export async function getAgentChatHistory(agentId: string, userEmail: string) {
  await db.delete(AgentChatHistory).where(
    sql`${AgentChatHistory.updatedAt} < now() - interval '3 days'`
  );

  const [history] = await db
    .select()
    .from(AgentChatHistory)
    .where(
      and(
        eq(AgentChatHistory.agentId, agentId),
        eq(AgentChatHistory.userEmail, userEmail)
      )
    )
    .limit(1);

  return history ?? null;
}
