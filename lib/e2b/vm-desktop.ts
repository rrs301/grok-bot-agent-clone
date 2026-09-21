import { Sandbox } from "@e2b/desktop"
import { and, eq } from "drizzle-orm"
import { AgentConfig, db } from "@/db"

export const VM_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000

const sandboxOptions = {
  timeoutMs: VM_INACTIVITY_TIMEOUT_MS,
  lifecycle: {
    onTimeout: "pause" as const,
    autoResume: true,
  },
  resolution: [1280, 800] as [number, number],
  metadata: {
    app: "grok-bot-agent-clone",
    feature: "agent-vm-desktop",
  },
}

export function isE2BConfigured() {
  return Boolean(process.env.E2B_API_KEY)
}

export async function createDesktopSandbox(agentId: string, userEmail: string) {
  return Sandbox.create({
    ...sandboxOptions,
    metadata: {
      ...sandboxOptions.metadata,
      agentId,
      userEmail,
    },
  })
}

export async function connectDesktopSandbox(sandboxId: string) {
  return Sandbox.connect(sandboxId, sandboxOptions)
}

export async function getOrCreateDesktopSandbox(agentId: string, userEmail: string) {
  const [agent] = await db
    .select()
    .from(AgentConfig)
    .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))
    .limit(1)

  if (!agent) {
    throw new Error("Agent not found")
  }

  let desktop: Sandbox
  try {
    desktop = agent.e2bSandboxId
      ? await connectDesktopSandbox(agent.e2bSandboxId)
      : await createDesktopSandbox(agentId, userEmail)
  } catch (error) {
    await db
      .update(AgentConfig)
      .set({ e2bSandboxStatus: agent.e2bSandboxId ? "paused" : "inactive" })
      .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))

    throw error
  }

  const now = new Date()
  await db
    .update(AgentConfig)
    .set({
      e2bSandboxId: desktop.sandboxId,
      e2bSandboxStatus: "active",
      e2bLastActiveAt: now,
      e2bPausedAt: null,
    })
    .where(and(eq(AgentConfig.userEmail, userEmail), eq(AgentConfig.agentId, agentId)))

  return desktop
}

export async function pauseDesktopSandbox(sandboxId: string) {
  return Sandbox.betaPause(sandboxId)
}

export async function getDesktopSandboxInfo(sandboxId: string) {
  return Sandbox.getInfo(sandboxId)
}

export async function getDesktopStreamUrl(desktop: Sandbox) {
  try {
    await desktop.stream.stop()
  } catch {
    // It is fine if there was no previous stream in this resumed process.
  }

  await desktop.stream.start({ requireAuth: true })
  const authKey = desktop.stream.getAuthKey()

  return desktop.stream.getUrl({
    authKey,
    autoConnect: true,
    resize: "scale",
  })
}
