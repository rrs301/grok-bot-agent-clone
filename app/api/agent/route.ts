import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
// import { AgentConfig, db } from "@/db";

export async function POST(req: NextRequest) {
    const { agentId, name, description, agentImage } = await req.json();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Insert the new agent configuration into the database
    // const newAgentConfig = await db.insert(AgentConfig).values({
    //     agentId: agentId,
    //     name,
    //     description,
    //     agentImage,
    //     userEmail: session.user.email
    // }).returning();

    // return NextResponse.json({ message: "Agent configuration saved successfully", agentConfig: newAgentConfig });
}