import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AgentConfig, AgentWorkflows, db, Tools } from "@/db";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { agentResponseSchema } from "@/lib/openai/agent-response-schema";
import { buildAgentInstructions, createAgent } from "@/lib/openai/openai-agent";
import { RunState, run } from "@openai/agents";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const decisionSchema = z.object({
  workflowId: z.string().min(1),
  approved: z.boolean(),
});

const storedWorkflowSchema = z.object({
  snapshot: z.string(),
  timezone: z.string().default("UTC"),
  actions: z.array(z.object({
    tool: z.string(),
    summary: z.string(),
  })),
});

function guardChatTools(tools: any[]) {
  const excluded = new Set([
    "COMPOSIO_MANAGE_CONNECTIONS",
    "COMPOSIO_WAIT_FOR_CONNECTIONS",
    "COMPOSIO_REMOTE_BASH_TOOL",
    "COMPOSIO_REMOTE_WORKBENCH",
  ]);
  const readOnly = /(?:^|_)(?:GET|LIST|FETCH|SEARCH|FIND|READ|RETRIEVE|LOOKUP|QUERY|CHECK|VIEW)(?:_|$)/i;
  const mutating = /(?:^|_)(?:SEND|POST|CREATE|DELETE|REMOVE|UPDATE|EDIT|WRITE|REPLY|INVITE|PUBLISH|UPLOAD|MOVE|ARCHIVE|CANCEL)(?:_|$)/i;

  return tools
    .filter((tool) => !excluded.has(tool.name ?? ""))
    .map((tool) => {
      const toolName = tool.name ?? "";
      if (toolName === "COMPOSIO_MULTI_EXECUTE_TOOL") {
        return {
          ...tool,
          needsApproval: async (_context: unknown, args: { tools?: Array<{ tool_slug?: string }> }) =>
            (args.tools ?? []).some(({ tool_slug = "" }) =>
              mutating.test(tool_slug) || !readOnly.test(tool_slug)
            ),
        };
      }

      return mutating.test(toolName) || !readOnly.test(toolName)
        ? { ...tool, needsApproval: true }
        : tool;
    });
}

function summarizeInterruptions(interruptions: Array<{ name?: string; arguments?: string }>) {
  return interruptions.flatMap((interruption) => {
    try {
      const parsed = JSON.parse(interruption.arguments ?? "{}");
      if (Array.isArray(parsed?.tools)) {
        return parsed.tools.map((item: { tool_slug?: string; arguments?: unknown }) => ({
          tool: item.tool_slug ?? interruption.name ?? "External action",
          summary: JSON.stringify(item.arguments ?? {}),
        }));
      }
    } catch {
      // Use a safe generic description for malformed display arguments.
    }
    return [{ tool: interruption.name ?? "External action", summary: "Execute this external action." }];
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedDecision = decisionSchema.safeParse(await req.json());
  if (!parsedDecision.success) {
    return NextResponse.json({ error: "Invalid workflow decision" }, { status: 400 });
  }

  const [workflow] = await db
    .select()
    .from(AgentWorkflows)
    .where(
      and(
        eq(AgentWorkflows.id, parsedDecision.data.workflowId),
        eq(AgentWorkflows.userEmail, session.user.email),
        eq(AgentWorkflows.status, "pending_approval")
      )
    )
    .limit(1);
  if (!workflow) {
    return NextResponse.json(
      { error: "This approval request is no longer pending" },
      { status: 409 }
    );
  }

  if (!parsedDecision.data.approved) {
    const [rejected] = await db
      .update(AgentWorkflows)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(AgentWorkflows.id, workflow.id),
          eq(AgentWorkflows.status, "pending_approval")
        )
      )
      .returning({ id: AgentWorkflows.id });
    if (!rejected) {
      return NextResponse.json({ error: "This action was already handled" }, { status: 409 });
    }

    return NextResponse.json({
      response: agentResponseSchema.parse({
        type: "message",
        intent: "immediate_action",
        message: "Cancelled. Nothing was sent or changed.",
        questions: [],
        suggestedTools: [],
        routine: null,
        confirmation: null,
      }),
      toolCards: [],
    });
  }

  const stateData = storedWorkflowSchema.parse(workflow.state);
  const [claimed] = await db
    .update(AgentWorkflows)
    .set({ status: "executing", updatedAt: new Date() })
    .where(
      and(
        eq(AgentWorkflows.id, workflow.id),
        eq(AgentWorkflows.status, "pending_approval")
      )
    )
    .returning({ id: AgentWorkflows.id });
  if (!claimed) {
    return NextResponse.json({ error: "This action was already handled" }, { status: 409 });
  }

  try {
    const [[agentConfig], catalog] = await Promise.all([
      db.select().from(AgentConfig).where(
        and(
          eq(AgentConfig.agentId, workflow.agentId),
          eq(AgentConfig.userEmail, session.user.email)
        )
      ).limit(1),
      db.select().from(Tools).where(eq(Tools.isActive, true)),
    ]);
    if (!agentConfig) throw new Error("Agent not found");

    const activeAccounts = await getActiveConnectedAccounts(
      session.user.email,
      catalog.map((tool) => tool.slug)
    );
    const connectedSlugs = catalog
      .map((tool) => tool.slug)
      .filter((slug) => Boolean(activeAccounts[slug.toLowerCase()]?.length));
    const composioSession = await getOrCreateAgentSession(
      { ...agentConfig, tools: connectedSlugs },
      session.user.email,
      connectedSlugs
    );
    const tools = guardChatTools(await composioSession.tools());
    const instructions = buildAgentInstructions(
      agentConfig.name,
      agentConfig.description ?? "",
      catalog,
      connectedSlugs,
      stateData.timezone,
      false
    );
    const agent = createAgent(agentConfig.name, instructions, tools);
    const state = await RunState.fromString(agent, stateData.snapshot);
    const interruptions = state.getInterruptions();
    if (interruptions.length === 0) throw new Error("Approval state is no longer resumable");
    interruptions.forEach((interruption) => state.approve(interruption));

    const result = await run(agent, state, { maxTurns: 10 });
    if (result.interruptions.length > 0) {
      const actions = summarizeInterruptions(result.interruptions);
      await db
        .update(AgentWorkflows)
        .set({
          status: "pending_approval",
          state: { snapshot: result.state.toString(), timezone: stateData.timezone, actions },
          updatedAt: new Date(),
        })
        .where(eq(AgentWorkflows.id, workflow.id));

      return NextResponse.json({
        response: agentResponseSchema.parse({
          type: "confirmation",
          intent: "immediate_action",
          message: "Another external change requires confirmation.",
          questions: [],
          suggestedTools: [],
          routine: null,
          confirmation: {
            workflowId: workflow.id,
            title: "Confirm external action",
            description: "Nothing in this step has been changed yet.",
            actions,
          },
        }),
        toolCards: [],
      });
    }

    const response = agentResponseSchema.parse(result.finalOutput);
    await db
      .update(AgentWorkflows)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(AgentWorkflows.id, workflow.id));

    return NextResponse.json({ response, toolCards: [] });
  } catch (error) {
    await db
      .update(AgentWorkflows)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(AgentWorkflows.id, workflow.id));
    console.error("Unable to resume approved workflow", error);
    return NextResponse.json({ error: "Unable to execute the approved action" }, { status: 502 });
  }
}
