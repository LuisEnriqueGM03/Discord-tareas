import { Client, GatewayIntentBits } from 'discord.js';
import { DataSource } from 'typeorm';
import { Logger } from '../utils/Logger';

// Services
import { TaskService } from '../../application/services/TaskService';
import { TaskExecutionService } from '../../application/services/TaskExecutionService';
import { TaskBoardService } from '../../application/services/TaskBoardService';
import { NotificationService } from '../../application/services/NotificationService';
import { AuditLogService } from '../../application/services/AuditLogService';

// Ports
import { ITaskRepository } from '../../domain/ports/out/ITaskRepository';
import { ITaskExecutionRepository } from '../../domain/ports/out/ITaskExecutionRepository';
import { ITaskBoardRepository } from '../../domain/ports/out/ITaskBoardRepository';
import { INotificationPort } from '../../domain/ports/out/INotificationPort';
import { ISchedulerPort } from '../../domain/ports/out/ISchedulerPort';

// JSON Adapters
import { JsonTaskRepository } from '../adapters/out/persistence/json/JsonTaskRepository';
import { JsonTaskExecutionRepository } from '../adapters/out/persistence/json/JsonTaskExecutionRepository';
import { JsonTaskBoardRepository } from '../adapters/out/persistence/json/JsonTaskBoardRepository';

// TypeORM Adapters
import { TypeOrmTaskRepository } from '../adapters/out/persistence/typeorm/TypeOrmTaskRepository';
import { TypeOrmTaskExecutionRepository } from '../adapters/out/persistence/typeorm/TypeOrmTaskExecutionRepository';
import { TypeOrmTaskBoardRepository } from '../adapters/out/persistence/typeorm/TypeOrmTaskBoardRepository';

// Other Adapters
import { DiscordNotificationAdapter } from '../adapters/out/notification/DiscordNotificationAdapter';
import { NodeSchedulerAdapter } from '../adapters/out/scheduler/NodeSchedulerAdapter';

// Discord Bot
import { DiscordBotAdapter } from '../adapters/in/discord/DiscordBotAdapter';

// Config
import { loadEnvironmentConfig } from './EnvironmentConfig';
import { loadBotConfig } from './BotConfig';
import { loadDatabaseConfig, createDataSource } from './DatabaseConfig';

export class DIContainer {
  private static instance: DIContainer;

  // Repositories
  private taskRepository: ITaskRepository;
  private taskExecutionRepository: ITaskExecutionRepository;
  private taskBoardRepository: ITaskBoardRepository;

  // Ports
  private notificationPort: INotificationPort;
  private schedulerPort: ISchedulerPort;

  // Services
  private taskService: TaskService;
  private taskExecutionService: TaskExecutionService;
  private taskBoardService: TaskBoardService;
  private notificationService: NotificationService;
  private auditLogService: AuditLogService;

  // Discord
  private discordBotAdapter: DiscordBotAdapter;
  private client: Client;

  // Database
  private dataSource: DataSource | null = null;

  private constructor() {
    // Inicialización vacía - se configurará en initialize()
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  async initialize(): Promise<void> {
    const envConfig = loadEnvironmentConfig();
    const botConfig = loadBotConfig();

    // Inicializar repositorios según el tipo de persistencia
    if (envConfig.persistenceType === 'typeorm') {
      await this.initializeTypeOrmRepositories();
    } else {
      this.initializeJsonRepositories();
    }

    // Crear cliente de Discord con token y hacer login INMEDIATAMENTE
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
      ]
    });

    // Hacer login antes de crear los servicios
    await this.client.login(botConfig.token);
    Logger.info('Discord client logged in successfully');

    // Inicializar notification port con el cliente YA LOGUEADO
    this.notificationPort = new DiscordNotificationAdapter(this.client);

    // Inicializar AuditLogService
    this.auditLogService = new AuditLogService(this.client, envConfig.auditLogChannels);

    // Inicializar servicios
    this.taskService = new TaskService(this.taskRepository);

    // Inicializar scheduler port (necesita referencia al taskExecutionService)
    this.schedulerPort = new NodeSchedulerAdapter(
      async (taskExecutionId: string) => {
        // Si el ID comienza con "cooldown_", es una notificación de cooldown completo
        if (taskExecutionId.startsWith('cooldown_')) {
          await this.taskExecutionService.notifyCooldownComplete(taskExecutionId);
        } else {
          // Es la finalización normal de la duración de la tarea
          await this.taskExecutionService.completeTask(taskExecutionId);
        }
      }
    );
    
    this.taskExecutionService = new TaskExecutionService(
      this.taskExecutionRepository,
      this.taskRepository,
      this.taskBoardRepository,
      this.schedulerPort,
      this.notificationPort,
      this.auditLogService,
      this.client
    );

    this.taskBoardService = new TaskBoardService(
      this.taskBoardRepository,
      this.taskRepository
    );

    this.notificationService = new NotificationService(this.notificationPort);

    // Inicializar Discord Bot Adapter con el cliente ya logueado
    // El adapter ya no necesita hacer login
    this.discordBotAdapter = new DiscordBotAdapter(
      botConfig.token,
      botConfig.clientId,
      this.taskExecutionService,
      this.taskService,
      this.taskBoardService,
      this.notificationPort,
      this.taskExecutionRepository,
      this.auditLogService,
      botConfig.taskboardsConfigPath,
      this.client
    );
  }

  private initializeJsonRepositories(): void {
    const dataPath = './data';
    this.taskRepository = new JsonTaskRepository(dataPath);
    this.taskExecutionRepository = new JsonTaskExecutionRepository(dataPath);
    this.taskBoardRepository = new JsonTaskBoardRepository(dataPath);
  }

  private async initializeTypeOrmRepositories(): Promise<void> {
    const dbConfig = loadDatabaseConfig();
    this.dataSource = createDataSource(dbConfig);
    await this.dataSource.initialize();

    this.taskRepository = new TypeOrmTaskRepository(this.dataSource);
    this.taskExecutionRepository = new TypeOrmTaskExecutionRepository(this.dataSource);
    this.taskBoardRepository = new TypeOrmTaskBoardRepository(this.dataSource);
  }

  // Getters
  getTaskService(): TaskService {
    return this.taskService;
  }

  getTaskExecutionService(): TaskExecutionService {
    return this.taskExecutionService;
  }

  getTaskBoardService(): TaskBoardService {
    return this.taskBoardService;
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  getDiscordBotAdapter(): DiscordBotAdapter {
    return this.discordBotAdapter;
  }

  getSchedulerPort(): ISchedulerPort {
    return this.schedulerPort;
  }

  getTaskExecutionRepository(): ITaskExecutionRepository {
    return this.taskExecutionRepository;
  }

  async shutdown(): Promise<void> {
    if (this.discordBotAdapter) {
      await this.discordBotAdapter.stop();
    }
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
  }
}
