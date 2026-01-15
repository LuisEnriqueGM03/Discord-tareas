import { Repository, DataSource } from 'typeorm';
import { Task } from '../../../../../domain/models/Task';
import { ITaskRepository } from '../../../../../domain/ports/out/ITaskRepository';
import { TaskEntity } from './entities/TaskEntity';
import { ButtonStyle } from '../../../../../domain/enums/ButtonStyle';

export class TypeOrmTaskRepository implements ITaskRepository {
  private repository: Repository<TaskEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(TaskEntity);
  }

  private toDomain(entity: TaskEntity): Task {
    return {
      id: entity.id,
      name: entity.name,
      durationMinutes: entity.durationMinutes,
      cooldownMinutes: entity.cooldownMinutes,
      description: entity.description,
      emoji: entity.emoji,
      buttonStyle: entity.buttonStyle as ButtonStyle,
      boardId: entity.boardId,
      createdAt: entity.createdAt
    };
  }

  private toEntity(task: Task): Partial<TaskEntity> {
    return {
      id: task.id,
      name: task.name,
      durationMinutes: task.durationMinutes,
      cooldownMinutes: task.cooldownMinutes,
      description: task.description,
      emoji: task.emoji,
      buttonStyle: task.buttonStyle,
      boardId: task.boardId,
      createdAt: task.createdAt
    };
  }

  async findById(id: string): Promise<Task | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Task[]> {
    const entities = await this.repository.find();
    return entities.map(e => this.toDomain(e));
  }

  async save(task: Task): Promise<Task> {
    const entity = this.repository.create(this.toEntity(task));
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async update(task: Task): Promise<Task> {
    const entity = this.repository.create(this.toEntity(task));
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findByBoardId(boardId: string): Promise<Task[]> {
    const entities = await this.repository.find({ where: { boardId } });
    return entities.map(e => this.toDomain(e));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
