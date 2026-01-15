export interface ISchedulerPort {
  scheduleTaskCompletion(taskExecutionId: string, completionTime: Date): void;
  cancelScheduledTask(taskExecutionId: string): void;
}
