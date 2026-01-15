import { TaskExecution } from '../../models/TaskExecution';

export interface StartTaskParams {
  userId: string;
  taskId: string;
  guildId: string;
  channelId?: string; // Para tareas globales
}

export interface IStartTaskUseCase {
  execute(params: StartTaskParams): Promise<TaskExecution>;
}
