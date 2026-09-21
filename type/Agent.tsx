export type AgentConfigType = {
    name: string,
    agentId: string,
    description: string,
    agentImage: string,
    createdAt: Date,
    userEmail: string,
    composioSessionId: string,
    e2bSandboxId?: string | null,
    e2bSandboxStatus?: "active" | "inactive" | "paused" | "error" | null,
    e2bLastActiveAt?: Date | string | null,
    e2bPausedAt?: Date | string | null,
    tools: any
}
