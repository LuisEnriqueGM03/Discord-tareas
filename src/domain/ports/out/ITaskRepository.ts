import { Task } from '../../models/Task';

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  findByBoardId(boardId: string): Promise<Task[]>;
  delete(id: string): Promise<void>;
}
