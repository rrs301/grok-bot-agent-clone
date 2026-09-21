import { AgentConfig, db, RoutineExecutions, Routines } from '@/db';
import { getActiveConnectedAccounts, getOrCreateAgentSession } from '@/lib/composio/service';
import { routineSchema } from '@/lib/openai/agent-response-schema';
import { executeRoutine } from '@/lib/openai/openai-agent';
import { getNextRunAt, isRoutineScheduledAt } from '@/lib/routines/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { NonRetriableError } from 'inngest';
import { inngest } from './client';

const LOOK_AHEAD_MS = 60 * 60 * 1_000;

type RoutineRunEvent = {
  executionId: string;
  routineId: string;
  scheduledFor: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Routine execution failed';
}

function getExecutionId(routineId: string, scheduledFor: Date) {
  return `${routineId}:${scheduledFor.getTime()}`;
}

function getRunEventData(event: unknown): RoutineRunEvent | null {
  if (!event || typeof event !== 'object') return null;

  const data = 'data' in event ? event.data : null;
  if (!data || typeof data !== 'object') return null;

  const executionId = 'executionId' in data ? data.executionId : null;
  const routineId = 'routineId' in data ? data.routineId : null;
  const scheduledFor = 'scheduledFor' in data ? data.scheduledFor : null;

  if (
    typeof executionId !== 'string' ||
    typeof routineId !== 'string' ||
    typeof scheduledFor !== 'string'
  ) {
    return null;
  }

  return { executionId, routineId, scheduledFor };
}

/**
 * Runs at the top of every hour and only queues occurrences in the following
 * 60-minute window. The database unique constraint is the durable duplicate
 * guard; the deterministic Inngest event ID adds queue-level deduplication.
 */
export const scheduleRoutineExecutions = inngest.createFunction(
  {
    id: 'schedule-routine-executions',
    name: 'Schedule Upcoming Routine Executions',
    retries: 3,
  },
  { cron: '0 * * * *' },
  async ({ event, step }) => {
    // Using the cron event timestamp keeps the window stable across retries.
    const windowStart = new Date(event.ts ?? Date.now());
    const windowEnd = new Date(windowStart.getTime() + LOOK_AHEAD_MS);

    const executions = await step.run('find-and-reserve-upcoming-runs', async () => {
      const routines = await db
        .select()
        .from(Routines)
        .where(eq(Routines.isActive, true));
      const queued: RoutineRunEvent[] = [];

      for (const routine of routines) {
        const parsed = routineSchema.safeParse({
          name: routine.name,
          goal: routine.goal,
          instructions: routine.instructions,
          schedule: routine.schedule,
          tools: routine.tools,
        });

        if (!parsed.success) {
          console.error('Skipping routine with an invalid schedule', {
            routineId: routine.id,
            issues: parsed.error.issues,
          });
          continue;
        }

        let scheduledFor: Date | null;
        try {
          scheduledFor = getNextRunAt(
            parsed.data.schedule,
            new Date(windowStart.getTime() - 1)
          );
        } catch (error) {
          console.error('Skipping routine with an invalid timezone', {
            routineId: routine.id,
            error,
          });
          continue;
        }

        if (!scheduledFor || scheduledFor.getTime() >= windowEnd.getTime()) {
          continue;
        }

        const executionId = getExecutionId(routine.id, scheduledFor);
        await db
          .insert(RoutineExecutions)
          .values({
            id: executionId,
            routineId: routine.id,
            scheduledFor,
            status: 'queued',
          })
          .onConflictDoNothing({
            target: [RoutineExecutions.routineId, RoutineExecutions.scheduledFor],
          });

        // nextRunAt is for display/querying only; scheduling correctness comes
        // from recalculating the JSON schedule on every scan.
        if (routine.nextRunAt?.getTime() !== scheduledFor.getTime()) {
          await db
            .update(Routines)
            .set({ nextRunAt: scheduledFor })
            .where(eq(Routines.id, routine.id));
        }

        queued.push({
          executionId,
          routineId: routine.id,
          scheduledFor: scheduledFor.toISOString(),
        });
      }

      return queued;
    });

    if (executions.length > 0) {
      await step.sendEvent(
        'enqueue-routine-executions',
        executions.map((data) => ({
          id: `routine-run-${data.executionId}`,
          name: 'routine/run',
          data,
        }))
      );
    }

    return {
      queued: executions.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }
);

/** Execute one previously reserved routine occurrence. */
export const executeRoutineExecution = inngest.createFunction(
  {
    id: 'execute-ai-agent-routine',
    name: 'Execute AI Agent Routine',
    retries: 3,
    concurrency: {
      limit: 1,
      key: 'event.data.executionId',
    },
    onFailure: async ({ event, error, step }) => {
      const runEvent = getRunEventData(event.data.event);
      if (!runEvent) return;

      await step.run('record-terminal-failure', async () => {
        const scheduledFor = new Date(runEvent.scheduledFor);
        const [routine] = await db
          .select({ schedule: Routines.schedule, nextRunAt: Routines.nextRunAt })
          .from(Routines)
          .where(eq(Routines.id, runEvent.routineId))
          .limit(1);

        await db
          .update(RoutineExecutions)
          .set({
            status: 'failed',
            error: errorMessage(error),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(RoutineExecutions.id, runEvent.executionId),
              inArray(RoutineExecutions.status, ['queued', 'running'])
            )
          );

        if (!routine || Number.isNaN(scheduledFor.getTime())) return;

        const parsedSchedule = routineSchema.shape.schedule.safeParse(routine.schedule);
        if (!parsedSchedule.success) return;

        const nextRunAt = parsedSchedule.data.frequency === 'once'
          ? null
          : getNextRunAt(parsedSchedule.data, scheduledFor);

        if (routine.nextRunAt?.getTime() === scheduledFor.getTime()) {
          await db
            .update(Routines)
            .set({ nextRunAt, isActive: nextRunAt !== null })
            .where(eq(Routines.id, runEvent.routineId));
        }
      });
    },
  },
  { event: 'routine/run' },
  async ({ event, step }) => {
    const runEvent = getRunEventData(event);
    if (!runEvent) {
      throw new NonRetriableError('Invalid routine execution event');
    }

    const scheduledFor = new Date(runEvent.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new NonRetriableError('Invalid routine scheduled time');
    }

    if (scheduledFor.getTime() > Date.now()) {
      await step.sleepUntil('wait-for-exact-scheduled-time', scheduledFor);
    }

    const loaded = await step.run('load-and-validate-routine', async () => {
      const [execution] = await db
        .select()
        .from(RoutineExecutions)
        .where(
          and(
            eq(RoutineExecutions.id, runEvent.executionId),
            eq(RoutineExecutions.routineId, runEvent.routineId),
            eq(RoutineExecutions.scheduledFor, scheduledFor)
          )
        )
        .limit(1);

      if (!execution) {
        throw new NonRetriableError('Routine execution was not reserved');
      }
      if (execution.status !== 'queued') {
        return { runnable: false as const, status: execution.status };
      }

      const [routine] = await db
        .select()
        .from(Routines)
        .where(eq(Routines.id, runEvent.routineId))
        .limit(1);

      if (!routine || !routine.isActive) {
        await db
          .update(RoutineExecutions)
          .set({
            status: 'skipped',
            error: 'Routine is inactive or no longer exists',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(RoutineExecutions.id, runEvent.executionId));
        return { runnable: false as const, status: 'skipped' };
      }

      const draft = routineSchema.parse({
        name: routine.name,
        goal: routine.goal,
        instructions: routine.instructions,
        schedule: routine.schedule,
        tools: routine.tools,
      });

      if (!isRoutineScheduledAt(draft.schedule, scheduledFor)) {
        await db
          .update(RoutineExecutions)
          .set({
            status: 'skipped',
            error: 'The routine schedule changed before this execution started',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(RoutineExecutions.id, runEvent.executionId));
        return { runnable: false as const, status: 'skipped' };
      }

      const [agent] = await db
        .select()
        .from(AgentConfig)
        .where(
          and(
            eq(AgentConfig.agentId, routine.agentId),
            eq(AgentConfig.userEmail, routine.userEmail)
          )
        )
        .limit(1);
      if (!agent) throw new Error('Routine agent no longer exists');

      return { runnable: true as const, routine, agent, draft };
    });

    if (!loaded.runnable) return { status: loaded.status };

    const claimed = await step.run('mark-execution-running', async () => {
      const [execution] = await db
        .update(RoutineExecutions)
        .set({
          status: 'running',
          attempts: sql`${RoutineExecutions.attempts} + 1`,
          startedAt: new Date(),
          updatedAt: new Date(),
          error: null,
        })
        .where(
          and(
            eq(RoutineExecutions.id, runEvent.executionId),
            eq(RoutineExecutions.status, 'queued')
          )
        )
        .returning({ id: RoutineExecutions.id });

      return Boolean(execution);
    });

    if (!claimed) return { status: 'duplicate' };

    const toolSlugs = loaded.draft.tools.map((tool) => tool.slug);
    await step.run('verify-required-tool-connections', async () => {
      const connected = await getActiveConnectedAccounts(
        loaded.routine.userEmail,
        toolSlugs
      );
      const disconnected = toolSlugs.filter(
        (slug) => !connected[slug.toLowerCase()]?.length
      );

      if (disconnected.length > 0) {
        throw new Error(`Required tools are disconnected: ${disconnected.join(', ')}`);
      }

      return { connected: toolSlugs };
    });

    const result = await step.run('execute-agent-tool-workflow', async () => {
      const composioSession = await getOrCreateAgentSession(
        loaded.agent,
        loaded.routine.userEmail,
        toolSlugs
      );
      const tools = await composioSession.tools();

      const agentResult = await executeRoutine(
        loaded.agent.name,
        loaded.draft.instructions,
        tools,
        loaded.draft.schedule.timezone
      );

      if (agentResult.status === 'failed') {
        // The agent completed normally but reported that a required tool action
        // failed. Retrying the whole workflow could repeat earlier side effects.
        throw new NonRetriableError(agentResult.error ?? agentResult.summary);
      }

      return agentResult;
    });

    const completion = await step.run('record-completed-execution', async () => {
      const schedule = loaded.draft.schedule;
      const nextRunAt = schedule.frequency === 'once'
        ? null
        : getNextRunAt(schedule, scheduledFor);

      await db.transaction(async (tx) => {
        await tx
          .update(RoutineExecutions)
          .set({
            status: 'completed',
            result,
            error: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(RoutineExecutions.id, runEvent.executionId),
              eq(RoutineExecutions.status, 'running')
            )
          );

        await tx
          .update(Routines)
          .set({
            nextRunAt,
            isActive: nextRunAt !== null,
          })
          .where(
            and(
              eq(Routines.id, runEvent.routineId),
              eq(Routines.nextRunAt, scheduledFor)
            )
          );
      });

      return {
        status: 'completed',
        result,
        nextRunAt: nextRunAt?.toISOString() ?? null,
      };
    });

    return completion;
  }
);
