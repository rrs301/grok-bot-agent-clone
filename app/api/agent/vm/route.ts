import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { AgentConfig, db } from "@/db"
import { authOptions } from "../../auth/[...nextauth]/route"
import {
  connectDesktopSandbox,
  createDesktopSandbox,
  getDesktopSandboxInfo,
  getDesktopStreamUrl,
  isE2BConfigured,
  pauseDesktopSandbox,
} from "@/lib/e2b/vm-desktop"

type VmAction = "activate" | "pause" | "status"

async function getOwnedAgent(agentId: string, userEmail: string) {
  const agents = await db
    .select()
    .from(AgentConfig)
    .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))

  return agents[0]
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function missingApiKey() {
  return NextResponse.json(
    {
      error: "E2B API key is not configured",
      configured: false,
      env: "E2B_API_KEY",
    },
    { status: 503 }
  )
}

async function updateVmState(
  agentId: string,
  userEmail: string,
  values: Partial<typeof AgentConfig.$inferInsert>
) {
  const [updated] = await db
    .update(AgentConfig)
    .set(values)
    .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))
    .returning()

  return updated
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email

  if (!userEmail) {
    return unauthorized()
  }

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get("agentId")

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 })
  }

  const agent = await getOwnedAgent(agentId, userEmail)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  if (!isE2BConfigured()) {
    return NextResponse.json({
      configured: false,
      sandboxId: agent.e2bSandboxId,
      status: "unconfigured",
      env: "E2B_API_KEY",
    })
  }

  if (!agent.e2bSandboxId) {
    return NextResponse.json({
      configured: true,
      sandboxId: null,
      status: "inactive",
    })
  }

  try {
    const info = await getDesktopSandboxInfo(agent.e2bSandboxId)
    const status = info.state === "running" ? "active" : info.state

    if (status !== agent.e2bSandboxStatus) {
      await updateVmState(agentId, userEmail, {
        e2bSandboxStatus: status,
        e2bPausedAt: status === "paused" ? new Date() : agent.e2bPausedAt,
      })
    }

    return NextResponse.json({
      configured: true,
      sandboxId: agent.e2bSandboxId,
      status,
      endAt: info.endAt,
      lastActiveAt: agent.e2bLastActiveAt,
      pausedAt: status === "paused" ? agent.e2bPausedAt : null,
    })
  } catch (error) {
    await updateVmState(agentId, userEmail, { e2bSandboxStatus: "inactive" })

    return NextResponse.json({
      configured: true,
      sandboxId: agent.e2bSandboxId,
      status: "inactive",
      error: error instanceof Error ? error.message : "Unable to read VM status",
    })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email

  if (!userEmail) {
    return unauthorized()
  }

  const body = await req.json()
  const agentId = typeof body.agentId === "string" ? body.agentId : null
  const action = body.action as VmAction | undefined

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 })
  }

  if (!action || !["activate", "pause", "status"].includes(action)) {
    return NextResponse.json({ error: "Invalid VM action" }, { status: 400 })
  }

  const agent = await getOwnedAgent(agentId, userEmail)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  if (!isE2BConfigured()) {
    return missingApiKey()
  }

  if (action === "pause") {
    if (!agent.e2bSandboxId) {
      return NextResponse.json({
        configured: true,
        sandboxId: null,
        status: "inactive",
      })
    }

    await pauseDesktopSandbox(agent.e2bSandboxId)
    const pausedAt = new Date()
    const updatedAgent = await updateVmState(agentId, userEmail, {
      e2bSandboxStatus: "paused",
      e2bPausedAt: pausedAt,
    })

    return NextResponse.json({
      configured: true,
      sandboxId: agent.e2bSandboxId,
      status: "paused",
      pausedAt,
      agentConfig: updatedAgent,
    })
  }

  if (action === "status") {
    return GET(req)
  }

  let desktop

  try {
    desktop = agent.e2bSandboxId
      ? await connectDesktopSandbox(agent.e2bSandboxId)
      : await createDesktopSandbox(agentId, userEmail)
  } catch (error) {
    await updateVmState(agentId, userEmail, {
      e2bSandboxStatus: agent.e2bSandboxId ? "paused" : "inactive",
    })

    return NextResponse.json(
      {
        configured: true,
        sandboxId: agent.e2bSandboxId,
        status: agent.e2bSandboxId ? "paused" : "inactive",
        error:
          error instanceof Error
            ? error.message
            : "Unable to reconnect to the saved VM desktop.",
      },
      { status: 502 }
    )
  }

  const sandboxId = desktop.sandboxId
  const streamUrl = await getDesktopStreamUrl(desktop)
  const lastActiveAt = new Date()
  const updatedAgent = await updateVmState(agentId, userEmail, {
    e2bSandboxId: sandboxId,
    e2bSandboxStatus: "active",
    e2bLastActiveAt: lastActiveAt,
    e2bPausedAt: null,
  })

  return NextResponse.json({
    configured: true,
    sandboxId,
    status: "active",
    streamUrl,
    lastActiveAt,
    agentConfig: updatedAgent,
  })
}
