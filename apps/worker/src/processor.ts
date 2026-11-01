import { validateRunStateTransition } from '@agentflow/runtime';
import { createLogger } from '@agentflow/observability';

const logger = createLogger('worker-processor');

export interface JobPayload {
  jobId: string;
  runId: string;
  workspaceId: string;
}

export class RunJobProcessor {
  private activeJobsCount = 0;

  getActiveJobsCount(): number {
    return this.activeJobsCount;
  }

  async processRunJob(payload: JobPayload): Promise<{ success: boolean; runId: string }> {
    this.activeJobsCount++;
    logger.info('Processing run job', {
      jobId: payload.jobId,
      runId: payload.runId,
      workspaceId: payload.workspaceId
    });

    try {
      // Simulate state transition: queued -> initializing -> running -> succeeded
      validateRunStateTransition('queued', 'initializing');
      validateRunStateTransition('initializing', 'running');
      validateRunStateTransition('running', 'succeeded');

      return {
        success: true,
        runId: payload.runId
      };
    } finally {
      this.activeJobsCount--;
    }
  }
}
