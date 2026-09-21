import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, AgentWorkflows, db, Routines, Tools } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeAgentChat } from "@/lib/openai/openai-agent";
import { agentResponseSchema, routineSchema } from "@/lib/openai/agent-response-schema";
import { setAgentToolConnection } from "@/lib/agent-tools";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";
import { getAnsweredClarificationIds } from "@/lib/openai/clarification-context";
import { triggerRoutineRunNow } from "@/lib/routines/run-now";
import { getAgentChatHistory, saveAgentChatHistory } from "@/lib/agent-chat-history";

const routineLanguage = /\b(every|everyday|daily|weekly|monthly|hourly|recurring|schedule(?:d)?|routine|automation|automatically|monitor|digest|each\s+(?:day|morning|evening|week|month)|remind\s+me|tomorrow|tonight)\b/i;
const runRoutineLanguage = /\b(?:run|execute|start|trigger|launch)\b[\s\S]{0,80}\b(?:routine|automation)\b|\b(?:routine|automation)\b[\s\S]{0,80}\b(?:now|run|execute|start|trigger|launch)\b/i;

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const agentId = req.nextUrl.searchParams.get("agentId");

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!agentId) {
        return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
    }

    const [agentConfig] = await db.select({ agentId: AgentConfig.agentId }).from(AgentConfig)
        .where(
            and(
                eq(AgentConfig.agentId, agentId),
                eq(AgentConfig.userEmail, session.user.email)
            )
        )
        .limit(1);

    if (!agentConfig) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const history = await getAgentChatHistory(agentId, session.user.email);

    return NextResponse.json({
        history: history
            ? {
                messages: history.requestMessages,
                timezone: history.timezone,
                updatedAt: history.updatedAt,
            }
            : null,
    });
}

function isRoutinePlanningConversation(messages: any[]) {
    const latestUserMessage = [...messages]
        .reverse()
        .find((message) => message?.role === "user");
    if (routineLanguage.test(latestUserMessage?.content ?? "")) return true;

    const previousAgentMessage = [...messages]
        .reverse()
        .find((message) => message?.role === "agent" || message?.role === "assistant");

    return previousAgentMessage?.response?.intent === "routine"
        && previousAgentMessage?.response?.type === "clarification";
}

function dedupeSuggestions<T extends { slug: string }>(suggestions: T[]) {
    return [
        ...new Map(
            suggestions.map((suggestion) => [suggestion.slug.toLowerCase(), suggestion])
        ).values(),
    ];
}

function includesCatalogTool(text: string, slug: string, name: string) {
    const terms = [slug, name]
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 3);

    return terms.some((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
    });
}

function normalizeMatchText(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findRoutineForImmediateRun<T extends { id: string; name: string; goal: string; isActive: boolean }>(
    text: string,
    routines: T[]
) {
    const activeRoutines = routines.filter((routine) => routine.isActive);
    if (activeRoutines.length === 0) {
        return { routine: null, candidates: [] };
    }

    const normalizedText = normalizeMatchText(text);
    const exactMatches = activeRoutines.filter((routine) => {
        const normalizedName = normalizeMatchText(routine.name);
        return normalizedName.length > 0 && normalizedText.includes(normalizedName);
    });

    if (exactMatches.length === 1) {
        return { routine: exactMatches[0], candidates: exactMatches };
    }

    if (exactMatches.length > 1) {
        return { routine: null, candidates: exactMatches };
    }

    const tokenMatches = activeRoutines.filter((routine) => {
        const tokens = normalizeMatchText(`${routine.name} ${routine.goal}`)
            .split(" ")
            .filter((token) => token.length >= 4);

        return tokens.some((token) => normalizedText.includes(token));
    });

    if (tokenMatches.length === 1) {
        return { routine: tokenMatches[0], candidates: tokenMatches };
    }

    if (activeRoutines.length === 1) {
        return { routine: activeRoutines[0], candidates: activeRoutines };
    }

    return { routine: null, candidates: tokenMatches.length > 0 ? tokenMatches : activeRoutines };
}

function summarizeApprovalActions(actions: Array<{ tool: string; arguments: string }>) {
    return actions.flatMap((action) => {
        try {
            const parsed = JSON.parse(action.arguments);
            if (Array.isArray(parsed?.tools)) {
                return parsed.tools.map((item: { tool_slug?: string; arguments?: unknown }) => ({
                    tool: item.tool_slug ?? action.tool,
                    summary: JSON.stringify(item.arguments ?? {}),
                }));
            }
        } catch {
            // Fall back to the SDK tool name without exposing unparsed state.
        }

        return [{ tool: action.tool, summary: "Execute this external action." }];
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const { agentId, messages, timezone, editingRoutineId } = await req.json()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userEmail = session.user.email;

    if (!agentId || !Array.isArray(messages)) {
        return NextResponse.json({ error: "Missing agentId or messages" }, { status: 400 });
    }

    const answeredClarificationIds = getAnsweredClarificationIds(messages);

    const agentConfigs = await db.select().from(AgentConfig)
        .where(
            and(
                eq(AgentConfig.agentId, agentId),
                eq(AgentConfig.userEmail, session.user.email)
            )
        )
    const agentConfig = agentConfigs[0];

    if (!agentConfig) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const requestTimezone = typeof timezone === "string" && timezone ? timezone : "UTC";
    const persistChatResponse = async (
        body: { response?: unknown; toolCards?: unknown },
        init?: ResponseInit
    ) => {
        try {
            await saveAgentChatHistory({
                agentId,
                userEmail,
                messages,
                timezone: requestTimezone,
                editingRoutineId: typeof editingRoutineId === "string" ? editingRoutineId : null,
                response: body.response,
                toolCards: body.toolCards,
            });
        } catch (error) {
            console.error("Failed to save agent chat history", error);
        }

        return NextResponse.json(body, init);
    };

    const latestUserText = [...messages]
        .reverse()
        .find((message) => message?.role === "user" && typeof message?.content === "string")
        ?.content ?? "";

    if (runRoutineLanguage.test(latestUserText)) {
        const savedRoutines = await db
            .select()
            .from(Routines)
            .where(
                and(
                    eq(Routines.agentId, agentId),
                    eq(Routines.userEmail, userEmail)
                )
            );

        if (savedRoutines.length === 0) {
            return persistChatResponse({
                response: agentResponseSchema.parse({
                    type: "message",
                    intent: "immediate_action",
                    message: "You do not have any saved routines for this agent yet.",
                    questions: [],
                    suggestedTools: [],
                    routine: null,
                    confirmation: null,
                }),
                toolCards: [],
            });
        }

        const { routine, candidates } = findRoutineForImmediateRun(latestUserText, savedRoutines);
        if (!routine) {
            return persistChatResponse({
                response: agentResponseSchema.parse({
                    type: "clarification",
                    intent: "immediate_action",
                    message: "Which routine should I run now?",
                    questions: [{
                        id: "routine_to_run",
                        question: "Choose one routine to execute.",
                        options: candidates.map((candidate) => ({
                            label: candidate.name,
                            value: `Run routine ${candidate.name}`,
                            description: candidate.goal,
                        })),
                    }],
                    suggestedTools: [],
                    routine: null,
                    confirmation: null,
                }),
                toolCards: [],
            });
        }

        const runResult = await triggerRoutineRunNow({
            agentId,
            routineId: routine.id,
            userEmail,
        });

        if ("error" in runResult) {
            return persistChatResponse({
                response: agentResponseSchema.parse({
                    type: "message",
                    intent: "immediate_action",
                    message: runResult.error,
                    questions: [],
                    suggestedTools: [],
                    routine: null,
                    confirmation: null,
                }),
                toolCards: [],
            });
        }

        return persistChatResponse({
            response: agentResponseSchema.parse({
                type: "message",
                intent: "immediate_action",
                message: runResult.alreadyRunning
                    ? `“${runResult.routine.name}” is already running. I will not start a duplicate execution.`
                    : `Started “${runResult.routine.name}” now. You can track its status in the Schedule tab.`,
                questions: [],
                suggestedTools: [],
                routine: null,
                confirmation: null,
            }),
            toolCards: [],
        });
    }

    let editingRoutine = null;
    if (typeof editingRoutineId === "string" && editingRoutineId) {
        const [savedRoutine] = await db
            .select()
            .from(Routines)
            .where(
                and(
                    eq(Routines.id, editingRoutineId),
                    eq(Routines.agentId, agentId),
                    eq(Routines.userEmail, userEmail)
                )
            )
            .limit(1);

        if (!savedRoutine) {
            return NextResponse.json({ error: "Routine not found" }, { status: 404 });
        }

        editingRoutine = routineSchema.parse({
            name: savedRoutine.name,
            goal: savedRoutine.goal,
            instructions: savedRoutine.instructions,
            schedule: savedRoutine.schedule,
            tools: savedRoutine.tools,
        });
    }

    const planningOnly = Boolean(editingRoutine) || isRoutinePlanningConversation(messages);

    // The provider is the source of truth. Discover every active account in
    // the supported catalog instead of relying on a possibly stale JSON list
    // on AgentConfig.
    const tools = await db.select().from(Tools).where(eq(Tools.isActive, true));
    const activeAccounts = await getActiveConnectedAccounts(
        userEmail,
        tools.map((tool) => tool.slug)
    );
    const connectedToolSlugs = tools
        .map((tool) => tool.slug)
        .filter((slug) => Boolean(activeAccounts[slug.toLowerCase()]?.length));

    await Promise.all(
        connectedToolSlugs.map((slug) =>
            setAgentToolConnection(agentId, userEmail, slug, true)
        )
    );

    let agentComposioTools: any[] = [];
    let agentComposioSession: any = null;
    if (connectedToolSlugs.length > 0) {
        const composioSession = await getOrCreateAgentSession(
            { ...agentConfig, tools: connectedToolSlugs },
            userEmail,
            connectedToolSlugs
        );
        agentComposioSession = composioSession;
        const sessionTools = await composioSession.tools();

        // Authentication belongs to the app's connection-card flow. Prevent
        // the model from returning raw Composio authorization text or links.
        const excludedChatTools = new Set([
            "COMPOSIO_MANAGE_CONNECTIONS",
            "COMPOSIO_WAIT_FOR_CONNECTIONS",
            "COMPOSIO_REMOTE_BASH_TOOL",
            "COMPOSIO_REMOTE_WORKBENCH",
        ]);
        const readOnlyAction = /(?:^|_)(?:GET|LIST|FETCH|SEARCH|FIND|READ|RETRIEVE|LOOKUP|QUERY|CHECK|VIEW)(?:_|$)/i;
        const mutatingAction = /(?:^|_)(?:SEND|POST|CREATE|DELETE|REMOVE|UPDATE|EDIT|WRITE|REPLY|INVITE|PUBLISH|UPLOAD|MOVE|ARCHIVE|CANCEL)(?:_|$)/i;
        agentComposioTools = sessionTools
            .filter((tool: { name?: string }) => !excludedChatTools.has(tool.name ?? ""))
            .map((tool: { name?: string }) => {
                const toolName = tool.name ?? "";
                if (toolName === "COMPOSIO_MULTI_EXECUTE_TOOL") {
                    return {
                    ...tool,
                    needsApproval: async (_context: unknown, args: { tools?: Array<{ tool_slug?: string }> }) =>
                        (args.tools ?? []).some(({ tool_slug = "" }) =>
                            mutatingAction.test(tool_slug) || !readOnlyAction.test(tool_slug)
                        ),
                    };
                }

                return mutatingAction.test(toolName) || !readOnlyAction.test(toolName)
                    ? { ...tool, needsApproval: true }
                    : tool;
            });
    }

    const explicitlyRequestedConnection = /\b(?:connect|link|authorize)\b/i.test(latestUserText);
    const explicitlyMentionedTools = explicitlyRequestedConnection
        ? tools.filter((tool) =>
            includesCatalogTool(latestUserText, tool.slug, tool.name)
        )
        : [];

    const requestsSlackDelivery = (
        /\b(?:send|post|share|publish)\b[\s\S]{0,100}\bslack\b/i.test(latestUserText)
        || /\bslack\b[\s\S]{0,100}\b(?:send|post|share|publish)\b/i.test(latestUserText)
    );
    const hasSlackDestination = /#[a-z0-9_-]+|\bC[A-Z0-9]{8,}\b|slack\s+channel(?:\s+named)?\s+(?:["'][^"']+["']|[a-z0-9_-]+)/i
        .test(latestUserText);

    if (requestsSlackDelivery && !hasSlackDestination) {
        const mentionedTools = tools.filter((tool) =>
            includesCatalogTool(latestUserText, tool.slug, tool.name)
        );
        const disconnectedTools = mentionedTools.filter(
            (tool) => !activeAccounts[tool.slug.toLowerCase()]?.length
        );
        const slackConnected = Boolean(activeAccounts.slack?.length);
        let channelOptions: Array<{ label: string; value: string; description: string }> = [];

        if (slackConnected && agentComposioSession) {
            try {
                const channelResult = await agentComposioSession.execute(
                    "SLACK_LIST_CONVERSATIONS",
                    {
                        types: "public_channel,private_channel",
                        exclude_archived: true,
                        limit: 100,
                    }
                );
                const channels = Array.isArray(channelResult?.data?.channels)
                    ? channelResult.data.channels
                    : [];
                channelOptions = channels
                    .filter((channel: any) => channel?.id && channel?.name)
                    .map((channel: any) => ({
                        label: `#${channel.name}`,
                        value: `Use Slack channel #${channel.name} (ID: ${channel.id})`,
                        description: channel.is_private ? "Private channel" : "Public channel",
                    }));
            } catch (error) {
                console.error("Unable to list Slack channels", error);
            }
        }

        const questions = [];
        if (slackConnected) {
            questions.push({
                id: "slack_channel",
                question: channelOptions.length > 0
                    ? "Which Slack channel should receive the message?"
                    : "What is the Slack channel name or ID?",
                options: channelOptions,
            });
        }
        const requestText = messages
            .filter((message) => message?.role === "user" && typeof message?.content === "string")
            .map((message) => message.content)
            .join("\n");
        const hasTime = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i
            .test(requestText);
        if (planningOnly && !hasTime) {
            questions.push({
                id: "run_time",
                question: `What time should this routine run in ${requestTimezone || "your timezone"}?`,
                options: [],
            });
        }

        const suggestedTools = disconnectedTools.map((tool) => ({
            slug: tool.slug,
            name: tool.name,
            description: tool.description,
            reason: `Connect ${tool.name} so this agent can complete the requested workflow.`,
            icon: tool.icon,
            isConnected: false,
            isEnabled: tool.isActive !== false,
        }));

        return persistChatResponse({
            response: agentResponseSchema.parse({
                type: disconnectedTools.length > 0 && questions.length === 0
                    ? "tool_connection"
                    : "clarification",
                intent: planningOnly ? "routine" : "immediate_action",
                message: disconnectedTools.length > 0
                    ? "Connect the required apps and provide the missing destination details."
                    : "Choose the destination before I prepare anything for delivery.",
                questions,
                suggestedTools,
                routine: null,
                confirmation: null,
            }),
            toolCards: [],
        });
    }

    const execution = explicitlyMentionedTools.length > 0
        ? { response: {
            type: explicitlyMentionedTools.every((tool) =>
                Boolean(activeAccounts[tool.slug.toLowerCase()]?.length)
            ) ? "message" as const : "tool_connection" as const,
            intent: "immediate_action" as const,
            message: explicitlyMentionedTools.every((tool) =>
                Boolean(activeAccounts[tool.slug.toLowerCase()]?.length)
            )
                ? `${explicitlyMentionedTools.map((tool) => tool.name).join(", ")} is already connected and available to this agent.`
                : `Connect ${explicitlyMentionedTools
                    .filter((tool) => !activeAccounts[tool.slug.toLowerCase()]?.length)
                    .map((tool) => tool.name)
                    .join(", ")} below to give this agent access.`,
            questions: [],
            suggestedTools: explicitlyMentionedTools.map((tool) => ({
                slug: tool.slug,
                name: tool.name,
                description: tool.description,
                reason: `Connect ${tool.name} so this agent can use it on your behalf.`,
                icon: "",
                isConnected: false,
                isEnabled: true,
            })),
            routine: null,
            confirmation: null,
        }, pendingApproval: null }
        : await executeAgentChat(agentConfig.name, agentConfig?.description ?? '',
            messages, agentComposioTools, tools, connectedToolSlugs,
            requestTimezone,
            planningOnly,
            editingRoutine);

    let agentResponse = execution.response;
    if (execution.pendingApproval) {
        const workflowId = crypto.randomUUID();
        const actions = summarizeApprovalActions(execution.pendingApproval.actions);
        await db.insert(AgentWorkflows).values({
            id: workflowId,
            agentId,
            userEmail,
            status: "pending_approval",
            state: {
                snapshot: execution.pendingApproval.state,
                actions,
                timezone: requestTimezone,
            },
        });
        agentResponse = agentResponseSchema.parse({
            type: "confirmation",
            intent: "immediate_action",
            message: "Review this action before I perform it.",
            questions: [],
            suggestedTools: [],
            routine: null,
            confirmation: {
                workflowId,
                title: "Confirm external action",
                description: "Nothing has been sent or changed yet.",
                actions,
            },
        });
    }

    if (!agentResponse) {
        return NextResponse.json({ error: "Agent returned no response" }, { status: 502 });
    }

    const userRequestText = messages
        .filter((message) => message?.role === "user" && typeof message?.content === "string")
        .map((message) => message.content)
        .join("\n");
    const inferredRoutineTools = agentResponse.intent === "routine"
        ? tools
            .filter((tool) => includesCatalogTool(userRequestText, tool.slug, tool.name))
            .map((tool) => ({
                slug: tool.slug,
                name: tool.name,
                description: tool.description,
                reason: `Required for this routine's ${tool.name} step.`,
                icon: "",
                isConnected: false,
                isEnabled: true,
            }))
        : [];
    const responseRequestsConnection = agentResponse.type === "tool_connection"
        || /\b(?:connect|link|authorize)\b.{0,80}\b(?:account|app|integration|tool|slack|reddit|gmail|outlook|notion|calendar|github)\b/i
            .test(agentResponse.message);
    const inferredConnectionTools = agentResponse.intent !== "routine"
        && responseRequestsConnection
        ? tools
            .filter((tool) => includesCatalogTool(
                `${latestUserText}\n${agentResponse.message}`,
                tool.slug,
                tool.name
            ))
            .map((tool) => ({
                slug: tool.slug,
                name: tool.name,
                description: tool.description,
                reason: `Connect ${tool.name} so this agent can use it on your behalf.`,
                icon: "",
                isConnected: false,
                isEnabled: true,
            }))
        : [];
    const hasExplicitTime = Boolean(editingRoutine) || /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i
        .test(userRequestText);
    const requiresSlackChannel = agentResponse.intent === "routine"
        && inferredRoutineTools.some((tool) => tool.slug.toLowerCase() === "slack")
        && !editingRoutine
        && !/#[-\w]+|slack\s+channel(?:\s+named)?\s+(?:["'][^"']+["']|[a-z0-9_-]+)/i.test(userRequestText)
        && !answeredClarificationIds.has("slack_channel");
    const routineQuestions = [...agentResponse.questions];

    if (agentResponse.intent === "routine" && !hasExplicitTime
        && !answeredClarificationIds.has("run_time")
        && !routineQuestions.some((question) => /\btime\b|what hour/i.test(question.question))) {
        routineQuestions.push({
            id: "run_time",
            question: `What time should this routine run in ${requestTimezone || "your timezone"}?`,
            options: [],
        });
    }
    if (requiresSlackChannel
        && !routineQuestions.some((question) => /slack|channel/i.test(question.question))) {
        routineQuestions.push({
            id: "slack_channel",
            question: "Which Slack channel should receive the routine's output?",
            options: [],
        });
    }

    const mustClarifyRoutine = agentResponse.intent === "routine"
        && routineQuestions.length > 0;
    const responseBeforeConnectionStatus = mustClarifyRoutine
        ? {
            ...agentResponse,
            type: "clarification" as const,
            message: agentResponse.type === "routine"
                ? "I can set up that routine after you provide the missing details."
                : agentResponse.message,
            questions: routineQuestions,
            suggestedTools: dedupeSuggestions([
                ...agentResponse.suggestedTools,
                ...(agentResponse.routine?.tools ?? []),
                ...inferredRoutineTools,
            ]),
            routine: null,
        }
        : {
            ...agentResponse,
            questions: routineQuestions,
            suggestedTools: agentResponse.routine
                ? agentResponse.suggestedTools
                : dedupeSuggestions([
                    ...agentResponse.suggestedTools,
                    ...inferredRoutineTools,
                    ...inferredConnectionTools,
                ]),
            routine: agentResponse.routine
                ? {
                    ...agentResponse.routine,
                    tools: dedupeSuggestions([
                        ...agentResponse.routine.tools,
                        ...inferredRoutineTools,
                    ]),
                }
                : null,
        };

    const connectionSuggestions = responseBeforeConnectionStatus.suggestedTools
        .filter((suggestion) => inferredConnectionTools.some(
            (tool) => tool.slug.toLowerCase() === suggestion.slug.toLowerCase()
        ));
    const disconnectedConnectionSuggestions = connectionSuggestions.filter(
        (suggestion) => !activeAccounts[suggestion.slug.toLowerCase()]?.length
    );
    const response = connectionSuggestions.length > 0
        ? {
            ...responseBeforeConnectionStatus,
            type: disconnectedConnectionSuggestions.length > 0
                ? "tool_connection" as const
                : "message" as const,
            message: disconnectedConnectionSuggestions.length > 0
                ? `Connect ${disconnectedConnectionSuggestions
                    .map((tool) => tools.find(
                        (catalogTool) => catalogTool.slug.toLowerCase() === tool.slug.toLowerCase()
                    )?.name ?? tool.slug)
                    .join(", ")} below to give this agent access.`
                : `${connectionSuggestions
                    .map((tool) => tools.find(
                        (catalogTool) => catalogTool.slug.toLowerCase() === tool.slug.toLowerCase()
                    )?.name ?? tool.slug)
                    .join(", ")} is already connected and available to this agent.`,
            suggestedTools: disconnectedConnectionSuggestions,
        }
        : responseBeforeConnectionStatus;

    const toolsBySlug = new Map(
        tools.map((tool) => [tool.slug.toLowerCase(), tool])
    );

    const directSuggestions = response.suggestedTools.filter((suggestion) =>
        toolsBySlug.has(suggestion.slug.toLowerCase())
    );

    const routineSuggestions = (response.routine?.tools ?? []).filter((suggestion) =>
        toolsBySlug.has(suggestion.slug.toLowerCase())
    );

    const requestedSlugs = [
        ...new Set(
            [...directSuggestions, ...routineSuggestions].map(
                (suggestion) => toolsBySlug.get(suggestion.slug.toLowerCase())!.slug
            )
        ),
    ];

    const connectedAccounts = activeAccounts;

    // A connection may already exist for the user before this agent suggests
    // the tool. Bind every provider-verified active tool to this agent as well.
    await Promise.all(
        requestedSlugs
            .filter((slug) => Boolean(connectedAccounts[slug.toLowerCase()]?.length))
            .map((slug) =>
                setAgentToolConnection(agentId, userEmail, slug, true)
            )
    );

    const createToolCard = (suggestion: (typeof directSuggestions)[number]) => {
        const tool = toolsBySlug.get(suggestion.slug.toLowerCase())!;

        return {
            slug: tool.slug,
            name: tool.name,
            description: tool.description,
            reason: suggestion.reason,
            icon: tool.icon,
            isConnected: Boolean(connectedAccounts[tool.slug.toLowerCase()]?.length),
            isEnabled: tool.isActive !== false,
        };
    };

    const suggestedToolCards = directSuggestions
        .map(createToolCard)
        .filter((tool) => !tool.isConnected);
    const routineToolCards = routineSuggestions.map(createToolCard);

    const normalizedResponse = {
        ...response,
        suggestedTools: suggestedToolCards,
        routine: response.routine
            ? {
                ...response.routine,
                tools: routineSuggestions,
            }
            : null,
    };


    return persistChatResponse(
        {
            response: normalizedResponse,
            toolCards: routineToolCards
        })
}
