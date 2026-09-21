import { inngest } from './client';
import { AgentConfig, db, Routines } from '@/db';
import { getActiveConnectedAccounts, getOrCreateAgentSession } from '@/lib/composio/service';
import { executeRoutine } from '@/lib/openai/openai-agent';
import { RoutineDraft, routineSchema } from '@/lib/openai/agent-response-schema';
import { getNextRunAt } from '@/lib/routines/schedule';
import { and, eq } from 'drizzle-orm';

/**
 * Example 1: Event-driven Background Job
 * Triggered by sending an event with name: 'app/task.process'
 * Demonstrates multi-step durable execution with retries and sleep.
 */
export const processTaskBackgroundJob = inngest.createFunction(
  {
    id: 'process-task-job',
    name: 'Process Task Background Job',
    retries: 3,
  },
  { event: 'app/task.process' },
  async ({ event, step }) => {
    // Step 1: Initialize background task
    const initialResult = await step.run('init-task', async () => {
      console.log('Starting background processing for task payload:', event.data);
      return { taskId: event.data?.taskId || 'task_default', status: 'initialized' };
    });

    // Step 2: Pause or simulate asynchronous workflow delays
    await step.sleep('wait-for-processing', '2s');

    // Step 3: Complete background processing
    const completedResult = await step.run('complete-task', async () => {
      console.log('Completed processing task:', initialResult.taskId);
      return {
        taskId: initialResult.taskId,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      data: completedResult,
    };
  }
);

/**
 * Example 2: Scheduled Cron Job
 * Triggered automatically on a recurring schedule (e.g. daily at midnight: '0 0 * * *')
 */
export const dailySyncScheduledJob = inngest.createFunction(
  {
    id: 'daily-sync-job',
    name: 'Daily Sync Scheduled Cron Job',
  },
  { cron: '0 0 * * *' }, // Runs every day at 00:00 UTC
  async ({ step }) => {
    const syncResult = await step.run('run-scheduled-sync', async () => {
      console.log('Running scheduled daily maintenance & sync...');
      return {
        syncedRecords: 0,
        syncedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      summary: syncResult,
    };
  }
);

export const runRoutine = inngest.createFunction(
  {
    id: 'run-user-routine',
    name: 'Run User Routine',
    retries: 3,
  },
  { event: 'routine/run' },
  async ({ event, step }) => {
    const routineId = String(event.data?.routineId ?? '');
    const runAt = new Date(String(event.data?.runAt ?? ''));
    if (!routineId || Number.isNaN(runAt.getTime())) {
      throw new Error('Invalid routine event');
    }

    await step.sleepUntil('wait-for-routine-time', runAt);

    const loaded = await step.run('load-routine', async () => {
      const [routine] = await db
        .select()
        .from(Routines)
        .where(eq(Routines.id, routineId))
        .limit(1);
      if (!routine || !routine.isActive) return null;
      if (!routine.nextRunAt || routine.nextRunAt.getTime() !== runAt.getTime()) {
        return null;
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

      const draft = routineSchema.parse({
        name: routine.name,
        goal: routine.goal,
        instructions: routine.instructions,
        schedule: routine.schedule,
        tools: routine.tools,
      });

      return { routine, agent, draft };
    });

    if (!loaded) return { status: 'inactive' };

    const execution = await step.run('execute-routine', async () => {
      const toolSlugs = loaded.draft.tools.map((tool) => tool.slug);
      const connected = await getActiveConnectedAccounts(
        loaded.routine.userEmail,
        toolSlugs
      );
      const disconnected = toolSlugs.filter(
        (slug) => !connected[slug.toLowerCase()]?.length
      );
      if (disconnected.length > 0) {
        return {
          status: 'skipped',
          summary: `Required tools are disconnected: ${disconnected.join(', ')}`,
        };
      }

      try {
        const composioSession = await getOrCreateAgentSession(
          loaded.agent,
          loaded.routine.userEmail,
          toolSlugs
        );
        const tools = await composioSession.tools();
        const result = await executeRoutine(
          loaded.agent.name,
          loaded.draft.instructions,
          tools,
          loaded.draft.schedule.timezone
        );

        return { status: 'completed', summary: result.summary };
      } catch (error) {
        console.error('Routine execution failed', { routineId, error });
        return {
          status: 'failed',
          summary: error instanceof Error ? error.message : 'Routine execution failed',
        };
      }
    });

    const nextRunAt = await step.run('schedule-next-run', async () => {
      const schedule = loaded.draft.schedule as RoutineDraft['schedule'];
      const next = schedule.frequency === 'once'
        ? null
        : getNextRunAt(schedule, new Date(runAt.getTime() + 60_000));

      await db
        .update(Routines)
        .set({
          nextRunAt: next,
          isActive: next !== null,
        })
        .where(
          and(
            eq(Routines.id, routineId),
            eq(Routines.nextRunAt, runAt)
          )
        );

      if (next) {
        await inngest.send({
          name: 'routine/run',
          data: { routineId, runAt: next.toISOString() },
        });
      }

      return next?.toISOString() ?? null;
    });

    return { ...execution, nextRunAt };
  }
);
