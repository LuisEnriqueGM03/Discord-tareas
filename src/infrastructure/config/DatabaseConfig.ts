import { DataSource, DataSourceOptions } from 'typeorm';
import { TaskBoardEntity, TaskEntity, TaskExecutionEntity } from '../adapters/out/persistence/typeorm/entities';

export interface DatabaseConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function loadDatabaseConfig(): DatabaseConfig {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'discord_tasks'
  };
}

export function createDataSource(config: DatabaseConfig): DataSource {
  const options: DataSourceOptions = {
    type: config.type,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: [TaskBoardEntity, TaskEntity, TaskExecutionEntity],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development'
  };

  return new DataSource(options);
}
