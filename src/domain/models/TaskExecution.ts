import { TaskExecutionStatus } from '../enums/TaskExecutionStatus';

export interface TaskExecution {
  id: string;
  taskId: string;
  userId: string;
  guildId: string;
  channelId?: string; // Canal donde se inició la tarea global
  startedAt: Date;
  completedAt?: Date;
  availableAt?: Date;
  status: TaskExecutionStatus;
  currentUses?: number; // Cuántas veces se ha usado en esta sesión
  createdAt: Date;
}
