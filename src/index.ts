import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DIContainer } from './infrastructure/config/DIContainer';
import { Logger } from './infrastructure/utils/Logger';
import { TaskExecutionStatus } from './domain/enums/TaskExecutionStatus';
import { NodeSchedulerAdapter } from './infrastructure/adapters/out/scheduler/NodeSchedulerAdapter';

// Cargar variables de entorno
dotenv.config();

async function bootstrap(): Promise<void> {
  Logger.info('Starting Discord Task Bot...');

  try {
    // Inicializar contenedor de dependencias
    const container = DIContainer.getInstance();
    await container.initialize();

    // Restaurar tareas programadas pendientes
    await restoreScheduledTasks(container);

    // Iniciar el bot
    const bot = container.getDiscordBotAdapter();
    await bot.start();

    Logger.info('Discord Task Bot started successfully!');

    // Manejar señales de terminación
    setupGracefulShutdown(container);

  } catch (error) {
    Logger.error('Failed to start Discord Task Bot:', error);
    process.exit(1);
  }
}

async function restoreScheduledTasks(container: DIContainer): Promise<void> {
  try {
    const taskExecutionRepository = container.getTaskExecutionRepository();
    const schedulerPort = container.getSchedulerPort() as NodeSchedulerAdapter;
    const taskService = container.getTaskService();

    // Obtener todas las ejecuciones en estado RUNNING
    const allExecutions = await taskExecutionRepository.findAll();
    const runningExecutions = allExecutions.filter(
      e => e.status === TaskExecutionStatus.RUNNING
    );

    if (runningExecutions.length === 0) {
      Logger.info('No pending task executions to restore');
      return;
    }

    const pendingTasks: Array<{ id: string; completionTime: Date }> = [];

    for (const execution of runningExecutions) {
      const task = await taskService.findById(execution.taskId);
      if (task) {
        const completionTime = new Date(
          new Date(execution.startedAt).getTime() + task.durationMinutes * 60 * 1000
        );
        pendingTasks.push({ id: execution.id, completionTime });
      }
    }

    await schedulerPort.restoreScheduledTasks(pendingTasks);
    Logger.info(`Restored ${pendingTasks.length} scheduled tasks`);

  } catch (error) {
    Logger.error('Error restoring scheduled tasks:', error);
  }
}

function setupGracefulShutdown(container: DIContainer): void {
  const shutdown = async (signal: string): Promise<void> => {
    Logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    try {
      await container.shutdown();
      Logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      Logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Manejar errores no capturados
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

// Iniciar la aplicación
bootstrap();
