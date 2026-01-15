import { TaskBoard } from '../../models/TaskBoard';

export interface ILoadTaskBoardsUseCase {
  execute(): Promise<TaskBoard[]>;
  loadFromConfigFile(filePath: string): Promise<TaskBoard>;
}
