import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { ReadyEvent, InteractionCreateEvent } from './events';
import { ButtonInteractionHandler } from './handlers';
import { CreateBoardCommand, ResetTaskCommand, ResetAllTasksCommand, ResetGlobalTaskCommand, ListTasksCommand, HelpCommand, ViewUserTasksCommand, MyTasksCommand } from './commands';
import { TaskExecutionService } from '../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../application/services/TaskService';
import { TaskBoardService } from '../../../../application/services/TaskBoardService';
import { INotificationPort } from '../../../../domain/ports/out/INotificationPort';
import { ITaskExecutionRepository } from '../../../../domain/ports/out/ITaskExecutionRepository';
import { AuditLogService } from '../../../../application/services/AuditLogService';
import { Logger } from '../../../utils/Logger';

export class DiscordBotAdapter {
  private client: Client;
  private rest: REST;

  constructor(
    private readonly token: string,
    private readonly clientId: string,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService,
    private readonly taskBoardService: TaskBoardService,
    private readonly notificationPort: INotificationPort,
    private readonly taskExecutionRepository: ITaskExecutionRepository,
    private readonly auditLogService: AuditLogService,
    private readonly configPath: string,
    client?: Client
  ) {
    if (client) {
      this.client = client;
    } else {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages
        ]
      });
    }

    this.rest = new REST({ version: '10' }).setToken(token);
  }

  async start(): Promise<void> {
    try {
      // Si el cliente no está logueado, hacer login
      if (!this.client.user) {
        Logger.info('Client not logged in, logging in...');
        await this.client.login(this.token);
      }

      // Registrar eventos
      this.registerEvents();

      // Registrar comandos slash
      await this.registerCommands();

      Logger.info('Discord bot started successfully');
    } catch (error) {
      Logger.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  private registerEvents(): void {
    // Ready event
    const readyEvent = new ReadyEvent(
      this.client,
      this.taskBoardService,
      this.configPath
    );
    readyEvent.register();

    // Commands
    const createBoardCommand = new CreateBoardCommand(this.taskBoardService);
    const resetTaskCommand = new ResetTaskCommand(this.taskExecutionService, this.taskService);
    const resetAllTasksCommand = new ResetAllTasksCommand(this.taskExecutionService, this.auditLogService);
    const resetGlobalTaskCommand = new ResetGlobalTaskCommand(this.taskExecutionService, this.taskService, this.taskExecutionRepository);
    const listTasksCommand = new ListTasksCommand(this.taskBoardService);
    const helpCommand = new HelpCommand();
    const viewUserTasksCommand = new ViewUserTasksCommand(this.taskExecutionService, this.taskService, this.taskBoardService);
    const myTasksCommand = new MyTasksCommand(this.taskExecutionService, this.taskService, this.taskBoardService);

    // Button interaction handler
    const buttonHandler = new ButtonInteractionHandler(
      this.taskExecutionService,
      this.taskService,
      this.notificationPort
    );

    // Interaction create event
    const interactionEvent = new InteractionCreateEvent(
      this.client,
      buttonHandler,
      {
        createboard: createBoardCommand,
        'reset-task': resetTaskCommand,
        'reset-all-tasks': resetAllTasksCommand,
        'reset-global-task': resetGlobalTaskCommand,
        'list-tasks': listTasksCommand,
        ayuda: helpCommand,
        'ver-tareas': viewUserTasksCommand,
        'mis-tareas': myTasksCommand
      }
    );
    interactionEvent.register();
  }

  private async registerCommands(): Promise<void> {
    try {
      const createBoardCommand = new CreateBoardCommand(this.taskBoardService);
      const resetTaskCommand = new ResetTaskCommand(this.taskExecutionService, this.taskService);
      const resetAllTasksCommand = new ResetAllTasksCommand(this.taskExecutionService, this.auditLogService);
      const resetGlobalTaskCommand = new ResetGlobalTaskCommand(this.taskExecutionService, this.taskService, this.taskExecutionRepository);
      const listTasksCommand = new ListTasksCommand(this.taskBoardService);
      const helpCommand = new HelpCommand();
      const viewUserTasksCommand = new ViewUserTasksCommand(this.taskExecutionService, this.taskService, this.taskBoardService);
      const myTasksCommand = new MyTasksCommand(this.taskExecutionService, this.taskService, this.taskBoardService);

      const commands = [
        createBoardCommand.data.toJSON(),
        resetTaskCommand.data.toJSON(),
        resetAllTasksCommand.data.toJSON(),
        resetGlobalTaskCommand.data.toJSON(),
        listTasksCommand.data.toJSON(),
        helpCommand.data.toJSON(),
        viewUserTasksCommand.data.toJSON(),
        myTasksCommand.data.toJSON()
      ];

      Logger.info('Started refreshing application (/) commands.');

      await this.rest.put(
        Routes.applicationCommands(this.clientId),
        { body: commands }
      );

      Logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      Logger.error('Error registering commands:', error);
    }
  }

  getClient(): Client {
    return this.client;
  }

  async stop(): Promise<void> {
    this.client.destroy();
    Logger.info('Discord bot stopped');
  }
}
