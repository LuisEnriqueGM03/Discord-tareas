import { v4 as uuidv4 } from 'uuid';
import { Task } from '../../domain/models/Task';
import { ITaskRepository } from '../../domain/ports/out/ITaskRepository';
import { TaskNotFoundException } from '../../domain/exceptions/TaskNotFoundException';
import { ButtonStyle } from '../../domain/enums/ButtonStyle';

export class TaskService {
  constructor(private readonly taskRepository: ITaskRepository) {}

  async findById(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new TaskNotFoundException(id);
    }
    return task;
  }

  async findAll(): Promise<Task[]> {
    return this.taskRepository.findAll();
  }

  async findByBoardId(boardId: string): Promise<Task[]> {
    return this.taskRepository.findByBoardId(boardId);
  }

  async createTask(params: {
    name: string;
    durationMinutes: number;
    cooldownMinutes: number;
    boardId: string;
    description?: string;
    emoji?: string;
    buttonStyle: ButtonStyle;
  }): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      name: params.name,
      durationMinutes: params.durationMinutes,
      cooldownMinutes: params.cooldownMinutes,
      boardId: params.boardId,
      description: params.description,
      emoji: params.emoji,
      buttonStyle: params.buttonStyle,
      createdAt: new Date()
    };

    return this.taskRepository.save(task);
  }

  async deleteTask(id: string): Promise<void> {
    await this.taskRepository.delete(id);
  }
}
