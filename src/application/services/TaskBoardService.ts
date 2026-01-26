import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { TaskBoard } from '../../domain/models/TaskBoard';
import { TaskBoardConfig } from '../../domain/models/TaskBoardConfig';
import { Task } from '../../domain/models/Task';
import { ITaskBoardRepository } from '../../domain/ports/out/ITaskBoardRepository';
import { ITaskRepository } from '../../domain/ports/out/ITaskRepository';
import { InvalidBoardConfigException } from '../../domain/exceptions/InvalidBoardConfigException';
import { ColorValidator } from '../../infrastructure/utils/ColorValidator';
import { ButtonStyle } from '../../domain/enums/ButtonStyle';
import { Logger } from '../../infrastructure/utils/Logger';

export class TaskBoardService {
  constructor(
    private readonly taskBoardRepository: ITaskBoardRepository,
    private readonly taskRepository: ITaskRepository
  ) {}

  async execute(config: TaskBoardConfig): Promise<TaskBoard> {
    // Validar configuración
    this.validateConfig(config);

    const boardId = uuidv4();
    const now = new Date();

    // Crear las tareas
    const tasks: Task[] = await Promise.all(
      config.tasks.map(async (taskConfig) => {
        const task: Task = {
          id: uuidv4(),
          name: taskConfig.name,
          durationMinutes: taskConfig.durationMinutes,
          cooldownMinutes: taskConfig.cooldownMinutes,
          description: taskConfig.description,
          emoji: taskConfig.emoji,
          buttonStyle: taskConfig.buttonStyle as ButtonStyle,
          maxUses: taskConfig.maxUses,
          isGlobal: taskConfig.isGlobal,
          notificationIntervalMinutes: taskConfig.notificationIntervalMinutes,
          earlyNotificationMinutes: taskConfig.earlyNotificationMinutes,
          boardId: boardId,
          createdAt: now
        };
        return this.taskRepository.save(task);
      })
    );

    // Crear el board
    const board: TaskBoard = {
      id: boardId,
      channelId: config.channelId,
      guildId: config.guildId,
      title: config.title,
      description: config.description,
      color: ColorValidator.validateAndNormalize(config.color),
      tasks: tasks,
      createdAt: now
    };

    return this.taskBoardRepository.save(board);
  }

  async loadAll(): Promise<TaskBoard[]> {
    const boards = await this.taskBoardRepository.findAll();
    
    // Cargar las tareas para cada board
    for (const board of boards) {
      board.tasks = await this.taskRepository.findByBoardId(board.id);
    }

    return boards;
  }

  async loadFromConfigFile(filePath: string): Promise<TaskBoard> {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      const config: TaskBoardConfig = JSON.parse(fileContent);

      // Verificar si ya existe un board para este canal
      const existingBoard = await this.taskBoardRepository.findByChannelId(config.channelId);
      
      if (existingBoard) {
        // Cargar las tareas del board existente
        existingBoard.tasks = await this.taskRepository.findByBoardId(existingBoard.id);
        // Actualizar el board existente
        return this.updateExistingBoard(existingBoard, config);
      }

      // Crear nuevo board
      return this.execute(config);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InvalidBoardConfigException(`Error parsing JSON file: ${filePath}`);
      }
      throw error;
    }
  }

  async loadAllFromConfigDirectory(directoryPath: string): Promise<TaskBoard[]> {
    const absolutePath = path.resolve(directoryPath);
    
    Logger.info(`Loading taskboards from: ${absolutePath}`);
    
    if (!fs.existsSync(absolutePath)) {
      Logger.warn(`Config directory not found: ${absolutePath}`);
      return [];
    }

    const files = fs.readdirSync(absolutePath).filter(file => file.endsWith('.json'));
    Logger.info(`Found ${files.length} JSON files: ${files.join(', ')}`);
    
    const boards: TaskBoard[] = [];

    for (const file of files) {
      try {
        Logger.info(`Loading board from file: ${file}`);
        const board = await this.loadFromConfigFile(path.join(absolutePath, file));
        boards.push(board);
        Logger.info(`Successfully loaded board: ${board.title}`);
      } catch (error) {
        Logger.error(`Error loading board from file ${file}:`, error);
      }
    }

    return boards;
  }

  private async updateExistingBoard(existingBoard: TaskBoard, config: TaskBoardConfig): Promise<TaskBoard> {
    // Mapear tareas existentes por nombre para preservar IDs
    const existingTasksByName = new Map<string, Task>();
    for (const task of existingBoard.tasks) {
      existingTasksByName.set(task.name, task);
    }

    // Obtener nombres de tareas en la nueva configuración
    const newTaskNames = new Set(config.tasks.map(t => t.name));

    // Eliminar tareas que ya no existen en la configuración
    for (const task of existingBoard.tasks) {
      if (!newTaskNames.has(task.name)) {
        await this.taskRepository.delete(task.id);
      }
    }

    // Crear o actualizar tareas
    const tasks: Task[] = await Promise.all(
      config.tasks.map(async (taskConfig) => {
        const existingTask = existingTasksByName.get(taskConfig.name);
        
        if (existingTask) {
          // Actualizar tarea existente manteniendo el mismo ID
          existingTask.durationMinutes = taskConfig.durationMinutes;
          existingTask.cooldownMinutes = taskConfig.cooldownMinutes;
          existingTask.description = taskConfig.description;
          existingTask.emoji = taskConfig.emoji;
          existingTask.buttonStyle = taskConfig.buttonStyle as ButtonStyle;
          existingTask.maxUses = taskConfig.maxUses;
          existingTask.isGlobal = taskConfig.isGlobal;
          return this.taskRepository.update(existingTask);
        } else {
          // Crear nueva tarea
          const task: Task = {
            id: uuidv4(),
            name: taskConfig.name,
            durationMinutes: taskConfig.durationMinutes,
            cooldownMinutes: taskConfig.cooldownMinutes,
            description: taskConfig.description,
            emoji: taskConfig.emoji,
            buttonStyle: taskConfig.buttonStyle as ButtonStyle,
            maxUses: taskConfig.maxUses,
            isGlobal: taskConfig.isGlobal,
            boardId: existingBoard.id,
            createdAt: new Date()
          };
          return this.taskRepository.save(task);
        }
      })
    );

    // Actualizar el board
    existingBoard.title = config.title;
    existingBoard.description = config.description;
    existingBoard.color = ColorValidator.validateAndNormalize(config.color);
    existingBoard.tasks = tasks;
    existingBoard.updatedAt = new Date();

    return this.taskBoardRepository.update(existingBoard);
  }

  private validateConfig(config: TaskBoardConfig): void {
    if (!config.channelId) {
      throw new InvalidBoardConfigException('channelId is required');
    }
    if (!config.guildId) {
      throw new InvalidBoardConfigException('guildId is required');
    }
    if (!config.title) {
      throw new InvalidBoardConfigException('title is required');
    }
    if (!config.description) {
      throw new InvalidBoardConfigException('description is required');
    }
    if (!config.color) {
      throw new InvalidBoardConfigException('color is required');
    }
    if (!ColorValidator.isValidHexColor(config.color)) {
      throw new InvalidBoardConfigException(`Invalid hex color: ${config.color}`);
    }
    if (!config.tasks || config.tasks.length === 0) {
      throw new InvalidBoardConfigException('At least one task is required');
    }

    config.tasks.forEach((task, index) => {
      if (!task.name) {
        throw new InvalidBoardConfigException(`Task ${index + 1}: name is required`);
      }
      if (task.durationMinutes < 0) {
        throw new InvalidBoardConfigException(`Task ${index + 1}: durationMinutes cannot be negative`);
      }
      if (task.cooldownMinutes < 0) {
        throw new InvalidBoardConfigException(`Task ${index + 1}: cooldownMinutes cannot be negative`);
      }
      if (task.maxUses !== undefined && task.maxUses < 1) {
        throw new InvalidBoardConfigException(`Task ${index + 1}: maxUses must be at least 1`);
      }
    });
  }

  async updateBoardMessageId(boardId: string, messageId: string): Promise<void> {
    const board = await this.taskBoardRepository.findById(boardId);
    if (board) {
      board.messageId = messageId;
      await this.taskBoardRepository.update(board);
    }
  }
}
