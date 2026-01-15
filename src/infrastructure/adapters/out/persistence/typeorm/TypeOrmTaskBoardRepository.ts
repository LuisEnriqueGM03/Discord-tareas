import { Repository, DataSource } from 'typeorm';
import { TaskBoard } from '../../../../../domain/models/TaskBoard';
import { ITaskBoardRepository } from '../../../../../domain/ports/out/ITaskBoardRepository';
import { TaskBoardEntity } from './entities/TaskBoardEntity';

export class TypeOrmTaskBoardRepository implements ITaskBoardRepository {
  private repository: Repository<TaskBoardEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(TaskBoardEntity);
  }

  private toDomain(entity: TaskBoardEntity): TaskBoard {
    return {
      id: entity.id,
      channelId: entity.channelId,
      messageId: entity.messageId,
      guildId: entity.guildId,
      title: entity.title,
      description: entity.description,
      color: entity.color,
      tasks: [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private toEntity(board: TaskBoard): Partial<TaskBoardEntity> {
    return {
      id: board.id,
      channelId: board.channelId,
      messageId: board.messageId,
      guildId: board.guildId,
      title: board.title,
      description: board.description,
      color: board.color,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt
    };
  }

  async findById(id: string): Promise<TaskBoard | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<TaskBoard[]> {
    const entities = await this.repository.find();
    return entities.map(e => this.toDomain(e));
  }

  async findByGuildId(guildId: string): Promise<TaskBoard[]> {
    const entities = await this.repository.find({ where: { guildId } });
    return entities.map(e => this.toDomain(e));
  }

  async findByChannelId(channelId: string): Promise<TaskBoard | null> {
    const entity = await this.repository.findOne({ where: { channelId } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(board: TaskBoard): Promise<TaskBoard> {
    const entity = this.repository.create(this.toEntity(board));
    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async update(board: TaskBoard): Promise<TaskBoard> {
    await this.repository.update(board.id, this.toEntity(board));
    const updated = await this.repository.findOne({ where: { id: board.id } });
    return updated ? this.toDomain(updated) : board;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
