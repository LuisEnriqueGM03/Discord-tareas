import { TaskBoard } from '../../models/TaskBoard';
import { TaskBoardConfig } from '../../models/TaskBoardConfig';

export interface ICreateTaskBoardUseCase {
  execute(config: TaskBoardConfig): Promise<TaskBoard>;
}
