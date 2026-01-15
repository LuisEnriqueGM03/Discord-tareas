import { UserTaskStatus } from '../../models/UserTaskStatus';

export interface CheckTaskStatusParams {
  userId: string;
  taskId: string;
}

export interface ICheckTaskStatusUseCase {
  execute(params: CheckTaskStatusParams): Promise<UserTaskStatus>;
}
