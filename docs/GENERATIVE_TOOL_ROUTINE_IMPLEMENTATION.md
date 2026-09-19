# Simple AI routine and tool suggestions

This is an implementation guide for the existing codebase. The structured
response schema, agent output, chat API, routine table, and message fields are
already partially implemented. The next milestone is the type-based generative
UI described in Steps 5-12; the later steps cover connection, persistence, and
scheduling.

Required behavior:

- Normal request → return a text response.
- Missing routine details → return clarification questions.
- Routine needed → return one complete, structured routine proposal.
- One agent can own many routines.
- Every routine has its own AI-generated instructions, schedule, and tools.
- The user must connect required tools and confirm before the routine is saved.

Keep the current flow:

```text
ChatPanel -> /api/agent/chat -> OpenAI Agent -> structured response -> React UI
```

## Step 1: Add the response schema

Use the existing `lib/openai/agent-response-schema.tsx`:

```ts
import { z } from "zod";

export const routineSchema = z.object({
  name: z.string(),
  goal: z.string(),

  // Generated for this routine only.
  instructions: z.string(),

  schedule: z.object({
    startDate: z.string(), // YYYY-MM-DD
    time: z.string(),      // HH:mm
    timezone: z.string(),  // America/New_York
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    weekDays: z.array(
      z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
    ),
  }),

  tools: z.array(z.object({
    slug: z.string(),
    reason: z.string(),
  })),
});

export const agentResponseSchema = z.object({
  type: z.enum(["message", "clarification", "routine"]),
  message: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
  })),
  routine: routineSchema.nullable(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
```

Rules:

- `message`: `questions` is empty and `routine` is `null`.
- `clarification`: contains the missing questions and `routine` is `null`.
- `routine`: `questions` is empty and every routine field is filled.
- If date, time, timezone, frequency, goal, or tools are unclear, the AI must ask first instead of returning a partial routine.

Example:

```json
{
  "type": "routine",
  "message": "I prepared a weekday email summary routine.",
  "questions": [],
  "routine": {
    "name": "Weekday email summary",
    "goal": "Summarize priority unread emails every weekday morning.",
    "instructions": "Read unread Gmail messages since the previous run. Summarize important messages with sender, subject and required action. Do not send replies.",
    "schedule": {
      "startDate": "2026-09-21",
      "time": "09:00",
      "timezone": "America/New_York",
      "frequency": "weekly",
      "weekDays": ["MO", "TU", "WE", "TH", "FR"]
    },
    "tools": [
      {
        "slug": "gmail",
        "reason": "Read unread email."
      }
    ]
  }
}
```

## Step 2: Store multiple routines per agent

Add this table in `db/schema.ts`:

```ts
export const Routines = pgTable("routines", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id")
    .notNull()
    .references(() => AgentConfig.agentId),
  userEmail: text("user_email")
    .notNull()
    .references(() => users.email),

  name: varchar("name").notNull(),
  goal: text("goal").notNull(),
  instructions: text("instructions").notNull(),
  schedule: jsonb("schedule").notNull(),
  tools: jsonb("tools").notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

Each new routine is inserted as a new row with the same `agentId`:

```text
Agent A
  -> Gmail summary routine + Gmail instructions/tools
  -> GitHub report routine + GitHub instructions/tools
  -> Calendar routine + Calendar instructions/tools
```

Keep `AgentConfig.description` as the agent's general instructions. Store the generated instructions for each routine in `Routines.instructions`.

Run the existing migration commands after implementing the schema:

```bash
npm run db:generate
npm run db:push
```

## Step 3: Return structured output from the existing agent

Update `lib/openai/openai-agent.tsx`. Do not create a separate planner agent.

Add `outputType`:

```ts
import { agentResponseSchema } from "./agent-response-schema";

export const createAgent = (
  name: string,
  instructions: string,
  tools: any[] = [],
) => new Agent({
  name,
  instructions,
  tools,
  model: "gpt-5-mini",
  outputType: agentResponseSchema,
});
```

Change `executeAgentChat` so it accepts the tool catalog and timezone, then validates `finalOutput`:

```ts
export const executeAgentChat = async (
  name: string,
  instructions: string,
  messages: Message[],
  tools: any[] = [],
  availableTools: Array<{
    slug: string;
    name: string;
    description: string;
  }> = [],
  timezone = "UTC",
) => {
  const prompt = buildAgentInstructions(
    name,
    instructions,
    availableTools,
    timezone,
  );

  const agent = createAgent(name, prompt, tools);
  const history = messages.map((message) =>
    message.role === "user"
      ? user(message.content)
      : assistant(message.content),
  );

  const result = await run(agent, history);
  return agentResponseSchema.parse(result.finalOutput);
};
```

The installed OpenAI Agents SDK supports Zod through `outputType`, producing a validated structured `finalOutput`. See the official OpenAI [Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs).

## Step 4: Update the agent prompt

Change `buildAgentInstructions` so the agent knows when and how to propose a routine:

```ts
export const buildAgentInstructions = (
  agentName: string,
  customInstructions: string,
  availableTools: Array<{
    slug: string;
    name: string;
    description: string;
  }>,
  timezone: string,
) => `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}

Available tools:
${availableTools
  .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
  .join("\n")}

Return type="message" for a normal response.
Return type="clarification" if routine information is missing.
Return type="routine" for scheduled or repeated work.

A routine must contain name, goal, detailed routine-specific instructions,
start date, time, timezone, frequency, weekdays, and suggested tools.
Never return a partial routine. Ask questions first.
Suggest only tool slugs from Available tools.
Never claim a tool is connected.
Do not save the routine; the user must confirm it in the UI.
`.trim();
```

## Step 5: Update the existing chat API

In `app/api/agent/chat/route.ts`:

1. Read `timezone` with `agentId` and `messages`.
2. Load active rows from the existing `Tools` table.
3. Pass the catalog and timezone into `executeAgentChat`.
4. Remove suggested slugs not found in the catalog.
5. Check connection state with the existing `getActiveConnectedAccounts()` helper.
6. Return tool metadata for the UI.

Core change:

```ts
const availableTools = await db
  .select()
  .from(Tools)
  .where(eq(Tools.isActive, true));

const response = await executeAgentChat(
  agentConfig.name,
  agentConfig.description ?? "",
  messages,
  agentComposioTools,
  availableTools,
  timezone,
);

const bySlug = new Map(availableTools.map((tool) => [tool.slug, tool]));
const suggestions = (response.routine?.tools ?? [])
  .filter((tool) => bySlug.has(tool.slug));

if (response.routine) response.routine.tools = suggestions;

const active = await getActiveConnectedAccounts(
  session.user.email,
  suggestions.map((tool) => tool.slug),
);

const toolCards = suggestions.map((suggestion) => {
  const tool = bySlug.get(suggestion.slug)!;
  return {
    ...suggestion,
    name: tool.name,
    description: tool.description,
    icon: tool.icon,
    isEnabled: tool.isActive !== false,
    isConnected: Boolean(active[tool.slug]?.length),
  };
});

return NextResponse.json({ response, toolCards });
```

This normalization is required before building the UI. In the current route,
`response.routine.tools` contains objects shaped like `{ slug, reason }`, so do
not use `routineTools.includes(tool.slug)`. Match with `suggestion.slug`, as in
the example above. Also replace the current `ToolsConnection` response key with
the camel-case `toolCards` key and use `isConnected` consistently from the API
through the React components.

Add a 404 check before using `agentConfig.name`:

```ts
if (!agentConfig) {
  return NextResponse.json({ error: "Agent not found" }, { status: 404 });
}
```

## Step 6: Define one UI data contract

Keep the AI response types in `lib/openai/agent-response-schema.tsx`. Define the
server-enriched tool card type and extend `MessageType` in `type/Message.tsx`:

```ts
import type { AgentResponse } from "@/lib/openai/agent-response-schema";

export type ToolConnectionCardData = {
  slug: string;
  name: string;
  description: string;
  reason: string;
  icon?: string;
  isConnected: boolean;
  isEnabled: boolean;
};

export type MessageType = {
  id: string;
  role: "user" | "agent" | "assistant";
  content: string;
  time: string;
  response?: AgentResponse;
  toolCards?: ToolConnectionCardData[];
};
```

The boundary between the layers is:

```text
AgentResponse                    generated and validated by the AI layer
ToolConnectionCardData[]        enriched and verified by the server
MessageType                     stores both for rendering chat history
```

Do not put connection state inside `AgentResponse`. The model can suggest a
tool, but only the server can decide whether that tool exists, is enabled, and
is connected.

## Step 7: Store the complete response on the agent message

In `ChatPanel.tsx`, send only the message history needed by the agent, include
the browser timezone, and store the normalized API result:

```ts
const result = await axios.post("/api/agent/chat", {
  agentId,
  messages: updatedMsgs.map(({ role, content }) => ({ role, content })),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

const agentMsg: MessageType = {
  id: crypto.randomUUID(),
  role: "agent",
  content: result.data.response.message,
  response: result.data.response,
  toolCards: result.data.toolCards ?? [],
  time: new Date().toISOString(),
};
```

Keep `content` as a fallback for old messages and initial messages that do not
have a structured `response` yet.

## Step 8: Create `AgentResponseView` as the type-based renderer

Create `components/custom/agent-space/AgentResponseView.tsx`. This component is
the only place that decides which generated UI to show. It should not render an
avatar or the outer message bubble because the existing `AgentMessage` already
owns that layout.

```tsx
import type { MessageType } from "@/type/Message";
import { RoutineCard } from "./RoutineCard";

type AgentResponseViewProps = {
  message: MessageType;
  agentId: string;
};

export function AgentResponseView({
  message,
  agentId,
}: AgentResponseViewProps) {
  const response = message.response;

  if (!response) return <p>{message.content}</p>;

  switch (response.type) {
    case "message":
      return <p className="whitespace-pre-wrap">{response.message}</p>;

    case "clarification":
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap">{response.message}</p>
          <ol className="list-decimal space-y-2 pl-5">
            {response.questions.map((item) => (
              <li key={item.id}>{item.question}</li>
            ))}
          </ol>
        </div>
      );

    case "routine":
      if (!response.routine) {
        return <p>{response.message}</p>;
      }

      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap">{response.message}</p>
          <RoutineCard
            agentId={agentId}
            routine={response.routine}
            toolCards={message.toolCards ?? []}
          />
        </div>
      );

    default: {
      const exhaustiveCheck: never = response.type;
      return exhaustiveCheck;
    }
  }
}
```

The output for each response type is deliberately small:

| `response.type` | Generated UI |
| --- | --- |
| `message` | Plain agent text |
| `clarification` | Agent text followed by a numbered question list |
| `routine` | Agent text followed by one `RoutineCard` |

Users answer clarification questions through the existing chat input. A
separate generated form is not required for the first version.

## Step 9: Create `ToolConnectionCard`

Create `components/custom/agent-space/ToolConnectionCard.tsx`. It renders one
server-verified tool and owns only that tool's connect action.

Props:

```ts
type ToolConnectionCardProps = {
  agentId: string;
  tool: ToolConnectionCardData;
  onConnected: (slug: string) => void;
};
```

Render:

- the tool icon, name, and description;
- the AI-generated `reason` for this routine;
- a **Connected** badge when `tool.isConnected` is true;
- a **Connect** button when it is false;
- a disabled state when `tool.isEnabled` is false;
- a spinner while the connection request is starting.

Minimal connection behavior:

```tsx
async function connectTool() {
  setIsConnecting(true);

  try {
    const { data } = await axios.post("/api/tools/connect", {
      agentId,
      toolkitSlug: tool.slug,
    });

    const popup = window.open(
      data.redirectUrl,
      "connect-tool",
      "width=600,height=760",
    );

    // After the callback/popup completes, re-check status on the server.
    // Call onConnected(tool.slug) only after the server reports connected.
  } finally {
    setIsConnecting(false);
  }
}
```

Do not mark a tool connected just because the popup opened. Add or reuse a
server status endpoint and update the card only after Composio confirms the
active connection. `redirectUrl` should be returned by the connect endpoint;
it does not need to be stored permanently in `MessageType`.

## Step 10: Create `RoutineCard`

Create `components/custom/agent-space/RoutineCard.tsx`. It composes all routine
details and renders one `ToolConnectionCard` for each required tool.

Props:

```ts
import type { RoutineDraft } from "@/lib/openai/agent-response-schema";
import type { ToolConnectionCardData } from "@/type/Message";

type RoutineCardProps = {
  agentId: string;
  routine: RoutineDraft;
  toolCards: ToolConnectionCardData[];
};
```

Inside the component, copy `toolCards` into local state so a successful tool
connection can update this card without changing the historical AI response:

```tsx
const [tools, setTools] = useState(toolCards);

const markConnected = (slug: string) => {
  setTools((current) =>
    current.map((tool) =>
      tool.slug === slug ? { ...tool, isConnected: true } : tool,
    ),
  );
};

const requiredSlugs = routine.tools.map((tool) => tool.slug);
const requiredTools = tools.filter((tool) => requiredSlugs.includes(tool.slug));
const allConnected =
  requiredTools.length === requiredSlugs.length &&
  requiredTools.every((tool) => tool.isConnected);
```

Render:

- routine name and goal;
- routine-specific instructions;
- start date, time, timezone, frequency, and weekdays;
- the required tool list using `ToolConnectionCard`;
- **Create routine**, disabled until every required slug has a matching,
  connected card;
- loading, success, and error states for the create request.

Do not use `toolCards.every(...)` by itself. An empty array returns `true`, which
could enable routine creation even when required tool metadata is missing. The
length check above prevents that.

Create the routine only after explicit confirmation:

```tsx
async function createRoutine() {
  setIsCreating(true);

  try {
    await axios.post("/api/routines", { agentId, routine });
    setIsCreated(true);
  } finally {
    setIsCreating(false);
  }
}
```

The API must validate ownership, tool availability, and live connection state
again. The button state is user experience, not a security boundary.

## Step 11: Put the generated UI inside the existing `AgentMessage`

In the `messages.map(...)` block in `ChatPanel.tsx`, keep the existing
`AgentMessage` and replace only its children:

```tsx
{msg.role === "agent" || msg.role === "assistant" ? (
  <AgentMessage
    time={msg.time}
    agentAvatar={agentConfig?.agentImage ?? ""}
    agentName={agentConfig?.name ?? "Agent"}
  >
    <AgentResponseView message={msg} agentId={String(agentId)} />
  </AgentMessage>
) : (
  <UserMessage>{msg.content}</UserMessage>
)}
```

This preserves one outer agent message layout while allowing the content inside
it to be selected by `response.type`.

## Step 12: Verify all rendering branches

Before wiring persistence, test the renderer with fixed messages for every
branch:

1. A legacy agent message with only `content` renders the text fallback.
2. A `message` response renders no question list or cards.
3. A `clarification` response renders every question once and keeps the normal
   chat input available.
4. A `routine` response renders schedule details and the expected tool cards.
5. A disconnected tool shows **Connect** and keeps **Create routine** disabled.
6. Connecting every required tool enables **Create routine**.
7. Missing tool metadata keeps **Create routine** disabled.
8. A failed connect or create request shows an error and restores the button.
9. Reloading or adding a later message does not change older cards.

## Step 13: Connect tools

Add `POST /api/tools/connect`.

The route must authenticate, confirm agent ownership, and confirm the slug exists in `Tools`. Then use the installed Composio session API:

```ts
const composioSession = await composio.sessions.create(
  session.user.email,
  { toolkits: [toolkitSlug] },
);

const request = await composioSession.authorize(toolkitSlug, {
  callbackUrl: `${process.env.APP_URL}/workspace/${agentId}`,
});

return NextResponse.json({ redirectUrl: request.redirectUrl });
```

The tool card opens the URL:

```ts
const { data } = await axios.post("/api/tools/connect", {
  agentId,
  toolkitSlug: tool.slug,
});

window.open(data.redirectUrl, "connect-tool", "width=600,height=760");
```

After authorization, refresh status with `getActiveConnectedAccounts()`. Never accept `connected: true` from the AI or browser.

## Step 14: Save the confirmed routine

Add `POST /api/routines` and validate with the same schema:

```ts
const bodySchema = z.object({
  agentId: z.string().uuid(),
  routine: routineSchema,
});
```

The endpoint must verify agent ownership, tool slugs, and Composio connections. Calculate `nextRunAt`, then always insert a new row:

```ts
const [created] = await db.insert(Routines).values({
  id: crypto.randomUUID(),
  agentId,
  userEmail: session.user.email,
  name: routine.name,
  goal: routine.goal,
  instructions: routine.instructions,
  schedule: routine.schedule,
  tools: routine.tools,
  nextRunAt,
}).returning();
```

Always insert rather than update so the same agent can own multiple routines.

## Step 15: Schedule and list routines

After insertion, send an Inngest event:

```ts
await inngest.send({
  name: "routine/run",
  data: {
    routineId: created.id,
    runAt: created.nextRunAt?.toISOString(),
  },
});
```

Add a `routine/run` function to `lib/inngest/functions.ts` that:

1. waits until `runAt` with `step.sleepUntil`;
2. loads the routine by ID;
3. creates a Composio session using only `routine.tools`;
4. executes using `routine.instructions`;
5. calculates and enqueues the next run for recurring routines.

Register it in `app/api/inngest/route.ts`.

Finally, add `GET /api/routines?agentId=...` and replace the static content in `ScheduleTab.tsx` with all routines belonging to that agent and authenticated user.

## Minimal implementation order

For the current codebase, implement the next UI work in this order:

1. Normalize `/api/agent/chat` to return `{ response, toolCards }` with
   `reason`, `isEnabled`, and `isConnected` on every card.
2. Finalize `ToolConnectionCardData` and `MessageType`.
3. Store `response` and `toolCards` on each new agent message.
4. Add `AgentResponseView` and switch on `response.type`.
5. Add `ToolConnectionCard`.
6. Add `RoutineCard` and compose its tool cards.
7. Render `AgentResponseView` inside the existing `AgentMessage`.
8. Test message, clarification, routine, fallback, missing-tool, loading, and
   error states.
9. Add the connect and create APIs.
10. Schedule with Inngest and list saved routines in `ScheduleTab`.

## Files involved

```text
EXISTS lib/openai/agent-response-schema.tsx
EDIT  lib/openai/openai-agent.tsx
EDIT  app/api/agent/chat/route.ts
EDIT  type/Message.tsx
EDIT  components/custom/agent-space/ChatPanel.tsx
ADD   components/custom/agent-space/AgentResponseView.tsx
ADD   components/custom/agent-space/RoutineCard.tsx
ADD   components/custom/agent-space/ToolConnectionCard.tsx
EDIT  db/schema.ts
ADD   app/api/tools/connect/route.ts
ADD   app/api/routines/route.ts
EDIT  lib/inngest/functions.ts
EDIT  app/api/inngest/route.ts
EDIT  components/custom/agent-space/ScheduleTab.tsx
```

The most important rule is: the AI may propose a routine, its instructions, and tools, but only the authenticated server can verify tools and save or schedule the routine after user confirmation.
