import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentChatHistory, AgentConfig, AgentWorkflows, db, RoutineExecutions, Routines } from "@/db";
import { and, desc, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    const { agentId, name, description, agentImage } = await req.json();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Insert the new agent configuration into the database
    const newAgentConfig = await db.insert(AgentConfig).values({
        agentId: agentId,
        name,
        description,
        agentImage,
        userEmail: session.user.email
    }).returning();

    return NextResponse.json({ message: "Agent configuration saved successfully", agentConfig: newAgentConfig });
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");


    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (agentId) {

        // Fetch the specific agent configuration for the logged-in user
        const agentConfig = await db.select().from(AgentConfig)
            .where(and(eq(AgentConfig.userEmail, session.user.email),
                eq(AgentConfig.agentId, agentId)));

        return NextResponse.json(agentConfig[0]);
    }

    // Fetch all agent configurations for the logged-in user
    const agentConfigs = await db.select().from(AgentConfig)
        .where(eq(AgentConfig.userEmail, session.user.email))
        .orderBy(desc(AgentConfig.createdAt))
        ;

    return NextResponse.json(agentConfigs);
}

export async function PUT(req: NextRequest) {
    const agentConfig = await req.json();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!agentConfig?.agentId) {
        return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    const parseTimestamp = (value: unknown) => {
        if (value === null) return null;
        if (value === undefined) return undefined;
        if (value instanceof Date) return value;
        if (typeof value !== "string") return undefined;

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const updateValues: Partial<typeof AgentConfig.$inferInsert> = {};
    const setIfDefined = <K extends keyof typeof updateValues>(
        key: K,
        value: typeof updateValues[K] | undefined
    ) => {
        if (value !== undefined) updateValues[key] = value;
    }

    setIfDefined("name", typeof agentConfig.name === "string" ? agentConfig.name : undefined);
    setIfDefined("description", typeof agentConfig.description === "string" ? agentConfig.description : null);
    setIfDefined("agentImage", typeof agentConfig.agentImage === "string" ? agentConfig.agentImage : null);
    setIfDefined("tools", agentConfig.tools ?? undefined);
    setIfDefined("composioSessionId", typeof agentConfig.composioSessionId === "string" ? agentConfig.composioSessionId : null);
    setIfDefined("e2bSandboxId", typeof agentConfig.e2bSandboxId === "string" ? agentConfig.e2bSandboxId : null);
    setIfDefined("e2bSandboxStatus", typeof agentConfig.e2bSandboxStatus === "string" ? agentConfig.e2bSandboxStatus : null);
    setIfDefined("e2bLastActiveAt", parseTimestamp(agentConfig.e2bLastActiveAt));
    setIfDefined("e2bPausedAt", parseTimestamp(agentConfig.e2bPausedAt));

    //Update the Agent Config record
    const result = await db.update(AgentConfig)
        .set(updateValues).where(and(eq(AgentConfig.userEmail, session.user.email),
            eq(AgentConfig.agentId, agentConfig.agentId)))
        .returning();

    if (!result[0]) {
        return NextResponse.json({ error: "Agent configuration not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Agent configuration updated successfully", agentConfig: result[0] });
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
        return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    const [agent] = await db.select({ agentId: AgentConfig.agentId }).from(AgentConfig)
        .where(and(eq(AgentConfig.userEmail, session.user.email), eq(AgentConfig.agentId, agentId)))
        .limit(1);

    if (!agent) {
        return NextResponse.json({ error: "Agent configuration not found" }, { status: 404 });
    }

    const routines = await db.select({ id: Routines.id }).from(Routines)
        .where(and(eq(Routines.userEmail, session.user.email), eq(Routines.agentId, agentId)));

    await Promise.all([
        ...routines.map((routine) => db.delete(RoutineExecutions).where(eq(RoutineExecutions.routineId, routine.id))),
        db.delete(AgentChatHistory).where(and(eq(AgentChatHistory.userEmail, session.user.email), eq(AgentChatHistory.agentId, agentId))),
        db.delete(AgentWorkflows).where(and(eq(AgentWorkflows.userEmail, session.user.email), eq(AgentWorkflows.agentId, agentId))),
    ]);

    await db.delete(Routines).where(and(eq(Routines.userEmail, session.user.email), eq(Routines.agentId, agentId)));
    await db.delete(AgentConfig).where(and(eq(AgentConfig.userEmail, session.user.email), eq(AgentConfig.agentId, agentId)));

    return NextResponse.json({ message: "Agent deleted successfully" });
}
