import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { AgentConfig, db } from "@/db"
import { inngest } from "@/lib/inngest/client"
import { authOptions } from "../../auth/[...nextauth]/route"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const agentId = typeof body.agentId === "string" ? body.agentId : null
  const task = typeof body.task === "string" ? body.task.trim() : ""
  const timezone = typeof body.timezone === "string" && body.timezone
    ? body.timezone
    : "UTC"

  if (!agentId || !task) {
    return NextResponse.json(
      { error: "agentId and task are required" },
      { status: 400 }
    )
  }

  const [agent] = await db
    .select({ agentId: AgentConfig.agentId })
    .from(AgentConfig)
    .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))
    .limit(1)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const runId = crypto.randomUUID()
  await inngest.send({
    id: `vm-desktop-run-${runId}`,
    name: "agent/vm-desktop.run",
    data: {
      runId,
      agentId,
      userEmail,
      task,
      timezone,
    },
  })

  return NextResponse.json({
    success: true,
    runId,
    message: "VM desktop task queued.",
  })
}
