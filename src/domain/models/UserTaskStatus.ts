import { TaskExecutionStatus } from '../enums/TaskExecutionStatus';

export interface UserTaskStatus {
  userId: string;
  taskId: string;
  status: TaskExecutionStatus;
  remainingDurationMinutes?: number;
  remainingDurationSeconds?: number;
  remainingCooldownMinutes?: number;
  remainingCooldownSeconds?: number;
  remainingUses?: number; // Cuántos usos quedan antes del cooldown
  currentUses?: number; // Cuántos usos se han hecho
  nextAvailableAt?: Date;
}
