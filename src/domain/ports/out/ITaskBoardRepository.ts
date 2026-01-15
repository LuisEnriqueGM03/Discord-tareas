import { TaskBoard } from '../../models/TaskBoard';

export interface ITaskBoardRepository {
  findById(id: string): Promise<TaskBoard | null>;
  findAll(): Promise<TaskBoard[]>;
  findByGuildId(guildId: string): Promise<TaskBoard[]>;
  findByChannelId(channelId: string): Promise<TaskBoard | null>;
  save(board: TaskBoard): Promise<TaskBoard>;
  update(board: TaskBoard): Promise<TaskBoard>;
  delete(id: string): Promise<void>;
}
