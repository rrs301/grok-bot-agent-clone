import { inngest } from './client';

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
