import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db, Tools } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeAgentChat } from "@/lib/openai/openai-agent";
import { getActiveConnectedAccounts, getOrCreateAgentSession } from "@/lib/composio/service";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const { agentId, messages, timezone } = await req.json()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!agentId || !messages) {
        return NextResponse.json({ error: "Missing agentId or messages" }, { status: 400 });
    }

    let agentComposioTools: any[] = [];
    // Fetch agent configuration from the database or any other source based on the agentId

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

    if (agentConfig?.tools) {
        //@ts-ignore
        const composioSession = await getOrCreateAgentSession(agentConfig, session.user?.email);
        agentComposioTools = await composioSession.tools();
    }

    //All Available Tools
    const tools = await db.select().from(Tools).where(eq(Tools.isActive, true));

    // const toolsCatalog = tools.map((tool) => ({
    //     slug: tool.slug,
    //     name: tool.name,
    //     description: tool.description
    // }))
    // execute agent chat with Message History
    const response = await executeAgentChat(agentConfig.name, agentConfig?.description ?? '',
        messages, agentComposioTools, tools, timezone);

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
                (suggestion) => suggestion.slug
            )
        ),
    ];

    const connectedAccounts = await getActiveConnectedAccounts(
        session.user.email,
        requestedSlugs
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

    const suggestedToolCards = directSuggestions.map(createToolCard);
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


    return NextResponse.json(
        {
            response: normalizedResponse,
            toolCards: routineToolCards
        })
}
