import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AgentConfig, db, Tools } from "@/db"
import { composio } from "@/lib/composio/composio"
import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const requestSchema = z.object({
  agentId: z.string().min(1),
  toolkitSlug: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid connection request" }, { status: 400 })
  }

  const { agentId, toolkitSlug } = parsed.data
  const [agent] = await db
    .select({ agentId: AgentConfig.agentId })
    .from(AgentConfig)
    .where(
      and(
        eq(AgentConfig.agentId, agentId),
        eq(AgentConfig.userEmail, session.user.email)
      )
    )
    .limit(1)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const [tool] = await db
    .select({ slug: Tools.slug })
    .from(Tools)
    .where(and(eq(Tools.slug, toolkitSlug), eq(Tools.isActive, true)))
    .limit(1)

  if (!tool) {
    return NextResponse.json({ error: "Tool not found or unavailable" }, { status: 404 })
  }

  try {
    const composioSession = await composio.sessions.create(session.user.email, {
      toolkits: [tool.slug],
    })
    const request = await composioSession.authorize(tool.slug, {
      callbackUrl: `${req.nextUrl.origin}/workspace/${encodeURIComponent(agentId)}`,
    })

    if (!request.redirectUrl) {
      return NextResponse.json(
        { error: "This tool did not provide an authorization URL" },
        { status: 502 }
      )
    }

    return NextResponse.json({ redirectUrl: request.redirectUrl })
  } catch (error) {
    console.error("Unable to start tool connection", error)
    return NextResponse.json({ error: "Unable to start tool connection" }, { status: 502 })
  }
}
