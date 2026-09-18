import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AgentConfig, db } from "@/db";
import { and, eq } from "drizzle-orm";
import { executeAgentChat } from "@/lib/openai/openai-agent";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const { agentId, messages } = await req.json()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!agentId || !messages) {
        return NextResponse.json({ error: "Missing agentId or messages" }, { status: 400 });
    }

    // Fetch agent configuration from the database or any other source based on the agentId

    const agentConfigs = await db.select().from(AgentConfig)
        .where(
            and(
                eq(AgentConfig.agentId, agentId),
                eq(AgentConfig.userEmail, session.user.email)
            )
        )
    const agentConfig = agentConfigs[0];

    // execute agent chat with Message History

    const response = await executeAgentChat(agentConfig.name, agentConfig?.description ?? '', messages);

    return NextResponse.json({ response })
}