import { TaskExecution } from '../../models/TaskExecution';

export interface ITaskExecutionRepository {
  findActiveByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null>;
  findLastByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null>;
  save(execution: TaskExecution): Promise<TaskExecution>;
  findById(id: string): Promise<TaskExecution | null>;
  update(execution: TaskExecution): Promise<TaskExecution>;
  findAll(): Promise<TaskExecution[]>;
}
