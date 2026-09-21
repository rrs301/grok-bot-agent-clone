import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AgentConfig, db, Tools } from "@/db"
import { setAgentToolConnection } from "@/lib/agent-tools"
import { getActiveConnectedAccounts } from "@/lib/composio/service"
import { and, eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userEmail = session.user.email

  const agentId = req.nextUrl.searchParams.get("agentId")
  const toolkitSlug = req.nextUrl.searchParams.get("toolkitSlug")
  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 })
  }

  const [agent] = await db
    .select({ agentId: AgentConfig.agentId })
    .from(AgentConfig)
    .where(
      and(
        eq(AgentConfig.agentId, agentId),
        eq(AgentConfig.userEmail, userEmail)
      )
    )
    .limit(1)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  if (!toolkitSlug) {
    const tools = await db.select().from(Tools).where(eq(Tools.isActive, true))
    const accounts = await getActiveConnectedAccounts(
      userEmail,
      tools.map((tool) => tool.slug)
    )

    await Promise.all(
      tools
        .filter((tool) => Boolean(accounts[tool.slug.toLowerCase()]?.length))
        .map((tool) =>
          setAgentToolConnection(agentId, userEmail, tool.slug, true)
        )
    )

    const connectedTools = tools
      .filter((tool) => Boolean(accounts[tool.slug.toLowerCase()]?.length))
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        reason: "Allow this agent to use the app on your behalf.",
        icon: tool.icon,
        isConnected: true,
        isEnabled: tool.isActive !== false,
      }))

    return NextResponse.json({ tools: connectedTools })
  }

  const [tool] = await db
    .select({ slug: Tools.slug, isActive: Tools.isActive })
    .from(Tools)
    .where(eq(Tools.slug, toolkitSlug))
    .limit(1)

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 })
  }

  const accounts = await getActiveConnectedAccounts(userEmail, [tool.slug])
  const isConnected = Boolean(accounts[tool.slug.toLowerCase()]?.length)

  // Persist only a verified active connection here. A false status can also be
  // caused by a temporary provider error; explicit disconnects remove the slug.
  if (isConnected) {
    await setAgentToolConnection(agentId, userEmail, tool.slug, true)
  }

  return NextResponse.json({
    isConnected,
    isEnabled: tool.isActive !== false,
  })
}
