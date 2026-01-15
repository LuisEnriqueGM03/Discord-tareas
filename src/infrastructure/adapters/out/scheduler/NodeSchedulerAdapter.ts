import * as schedule from 'node-schedule';
import { ISchedulerPort } from '../../../../domain/ports/out/ISchedulerPort';
import { Logger } from '../../../utils/Logger';

export class NodeSchedulerAdapter implements ISchedulerPort {
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  private onTaskComplete: (taskExecutionId: string) => Promise<void>;

  constructor(onTaskComplete: (taskExecutionId: string) => Promise<void>) {
    this.onTaskComplete = onTaskComplete;
  }

  scheduleTaskCompletion(taskExecutionId: string, completionTime: Date): void {
    // Cancelar job existente si hay
    this.cancelScheduledTask(taskExecutionId);

    const job = schedule.scheduleJob(completionTime, async () => {
      Logger.info(`Task execution ${taskExecutionId} completed`);
      try {
        await this.onTaskComplete(taskExecutionId);
      } catch (error) {
        Logger.error(`Error completing task ${taskExecutionId}:`, error);
      }
      this.scheduledJobs.delete(taskExecutionId);
    });

    if (job) {
      this.scheduledJobs.set(taskExecutionId, job);
      Logger.info(`Scheduled task completion for ${taskExecutionId} at ${completionTime.toISOString()}`);
    }
  }

  cancelScheduledTask(taskExecutionId: string): void {
    const job = this.scheduledJobs.get(taskExecutionId);
    if (job) {
      job.cancel();
      this.scheduledJobs.delete(taskExecutionId);
      Logger.info(`Cancelled scheduled task ${taskExecutionId}`);
    }
  }

  // Método para restaurar tareas pendientes al reiniciar el bot
  async restoreScheduledTasks(
    pendingExecutions: Array<{ id: string; completionTime: Date }>
  ): Promise<void> {
    const now = new Date();
    
    for (const execution of pendingExecutions) {
      if (execution.completionTime > now) {
        this.scheduleTaskCompletion(execution.id, execution.completionTime);
      } else {
        // Si la tarea debería haber terminado, completarla ahora
        await this.onTaskComplete(execution.id);
      }
    }

    Logger.info(`Restored ${pendingExecutions.length} scheduled tasks`);
  }
}
