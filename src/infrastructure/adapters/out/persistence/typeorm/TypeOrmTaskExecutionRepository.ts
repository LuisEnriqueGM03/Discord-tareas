import { Repository, DataSource } from 'typeorm';
import { TaskExecution } from '../../../../../domain/models/TaskExecution';
import { ITaskExecutionRepository } from '../../../../../domain/ports/out/ITaskExecutionRepository';
import { TaskExecutionEntity } from './entities/TaskExecutionEntity';
import { TaskExecutionStatus } from '../../../../../domain/enums/TaskExecutionStatus';

export class TypeOrmTaskExecutionRepository implements ITaskExecutionRepository {
  private repository: Repository<TaskExecutionEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(TaskExecutionEntity);
  }

  private toDomain(entity: TaskExecutionEntity): TaskExecution {
    return {
      id: entity.id,
      taskId: entity.taskId,
      userId: entity.userId,
      guildId: entity.guildId,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      availableAt: entity.availableAt,
      status: entity.status as TaskExecutionStatus,
      createdAt: entity.createdAt
    };
  }

  private toEntity(execution: TaskExecution): Partial<TaskExecutionEntity> {
    return {
      id: execution.id,
      taskId: execution.taskId,
      userId: execution.userId,
      guildId: execution.guildId,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      availableAt: execution.availableAt,
      status: execution.status,
      createdAt: execution.createdAt
    };
  }

  async findActiveByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null> {
    const entity = await this.repository.findOne({
      where: {
        userId,
        taskId,
        status: TaskExecutionStatus.RUNNING
      }
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findLastByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null> {
    const entity = await this.repository.findOne({
      where: { userId, taskId },
      order: { createdAt: 'DESC' }
    });
    return entity ? this.toDomain(entity) : null;
  }

  async save(execution: TaskExecution): Promise<TaskExecution> {
    const entity = this.repository.create(this.toEntity(execution));
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<TaskExecution | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async update(execution: TaskExecution): Promise<TaskExecution> {
    await this.repository.update(execution.id, this.toEntity(execution));
    const updated = await this.repository.findOne({ where: { id: execution.id } });
    return updated ? this.toDomain(updated) : execution;
  }

  async findAll(): Promise<TaskExecution[]> {
    const entities = await this.repository.find();
    return entities.map(e => this.toDomain(e));
  }
}
