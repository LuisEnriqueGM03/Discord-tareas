import { v4 as uuidv4 } from 'uuid';
import { TaskExecution } from '../../domain/models/TaskExecution';
import { Task } from '../../domain/models/Task';
import { UserTaskStatus } from '../../domain/models/UserTaskStatus';
import { TaskExecutionStatus } from '../../domain/enums/TaskExecutionStatus';
import { ITaskExecutionRepository } from '../../domain/ports/out/ITaskExecutionRepository';
import { ITaskRepository } from '../../domain/ports/out/ITaskRepository';
import { ITaskBoardRepository } from '../../domain/ports/out/ITaskBoardRepository';
import { ISchedulerPort } from '../../domain/ports/out/ISchedulerPort';
import { INotificationPort } from '../../domain/ports/out/INotificationPort';
import { StartTaskParams } from '../../domain/ports/in/IStartTaskUseCase';
import { CheckTaskStatusParams } from '../../domain/ports/in/ICheckTaskStatusUseCase';
import { TaskNotFoundException } from '../../domain/exceptions/TaskNotFoundException';
import { TaskAlreadyRunningException } from '../../domain/exceptions/TaskAlreadyRunningException';
import { TaskOnCooldownException } from '../../domain/exceptions/TaskOnCooldownException';
import { TimeFormatter } from '../../infrastructure/utils/TimeFormatter';
import { Logger } from '../../infrastructure/utils/Logger';
import { EmbedBuilder, Client } from 'discord.js';
import { AuditLogService, AuditUserInfo } from './AuditLogService';

export class TaskExecutionService {
  constructor(
    private readonly taskExecutionRepository: ITaskExecutionRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly taskBoardRepository: ITaskBoardRepository,
    private readonly schedulerPort: ISchedulerPort,
    private readonly notificationPort: INotificationPort,
    private readonly auditLogService: AuditLogService,
    private readonly client: Client
  ) {}

  private schedulePeriodicNotifications(
    execution: TaskExecution,
    task: Task,
    realUserId: string
  ): void {
    if (!task.notificationIntervalMinutes || task.durationMinutes === 0) {
      return;
    }

    const intervalMs = task.notificationIntervalMinutes * 60 * 1000;
    const durationMs = task.durationMinutes * 60 * 1000;
    const earlyNotificationMs = (task.earlyNotificationMinutes || 0) * 60 * 1000;

    let currentTimeMs = intervalMs;
    let notificationCount = 0;

    // Programar notificaciones intermedias cada X horas
    while (currentTimeMs < durationMs - earlyNotificationMs) {
      notificationCount++;
      const hours = currentTimeMs / (60 * 60 * 1000);
      
      // Crear un timeout para cada notificación
      setTimeout(async () => {
        try {
          await this.notificationPort.sendDirectMessageEmbed(
            realUserId,
            new EmbedBuilder()
              .setColor(0x00CCFF)
              .setTitle('🔔 Notificación de Progreso')
              .setDescription(`Han pasado **${hours} horas** desde que iniciaste **${task.name}**`)
              .setTimestamp()
              .setFooter({ text: '¡Sigue adelante!' })
          );
          Logger.info(`Notificación intermedia ${notificationCount} enviada para tarea ${task.name} al usuario ${realUserId}`);
        } catch (error) {
          Logger.error(`Error enviando notificación intermedia para tarea ${task.name}:`, error);
        }
      }, currentTimeMs);

      currentTimeMs += intervalMs;
    }

    // Programar notificación final (10 minutos antes si está configurado)
    if (earlyNotificationMs > 0 && durationMs > earlyNotificationMs) {
      const finalNotificationTime = durationMs - earlyNotificationMs;
      
      setTimeout(async () => {
        try {
          await this.notificationPort.sendDirectMessageEmbed(
            realUserId,
            new EmbedBuilder()
              .setColor(0xFF9900)
              .setTitle('⚠️ ¡Tarea por Finalizar!')
              .setDescription(`Tu tarea de **${task.name}** está por terminar en **${task.earlyNotificationMinutes} minutos**`)
              .setTimestamp()
              .setFooter({ text: '¡Prepárate!' })
          );
          Logger.info(`Notificación final enviada para tarea ${task.name} al usuario ${realUserId}`);
        } catch (error) {
          Logger.error(`Error enviando notificación final para tarea ${task.name}:`, error);
        }
      }, finalNotificationTime);
    }

    Logger.info(`Programadas ${notificationCount} notificaciones intermedias + 1 final para tarea ${task.name}`);
  }

  private async getUserInfo(userId: string): Promise<AuditUserInfo> {
    try {
      const user = await this.client.users.fetch(userId);
      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.displayAvatarURL({ size: 128 })
      };
    } catch {
      return {
        id: userId,
        username: 'Unknown',
        displayName: 'Unknown User',
        avatarUrl: undefined
      };
    }
  }

  async execute(params: StartTaskParams): Promise<TaskExecution> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new TaskNotFoundException(params.taskId);
    }

    const maxUses = task.maxUses || 1;
    const isGlobal = task.isGlobal || false;

    // Para tareas globales, usar un userId especial
    const effectiveUserId = isGlobal ? `GLOBAL_${params.guildId}` : params.userId;

    // Verificar estado actual de la tarea
    const status = await this.checkStatus({ 
      userId: effectiveUserId, 
      taskId: params.taskId 
    });

    if (status.status === TaskExecutionStatus.RUNNING) {
      throw new TaskAlreadyRunningException(task.name, status.remainingDurationMinutes || 0);
    }

    if (status.status === TaskExecutionStatus.ON_COOLDOWN) {
      throw new TaskOnCooldownException(task.name, status.remainingCooldownMinutes || 0);
    }

    // Para tareas con múltiples usos, buscar la ejecución actual o crear una nueva
    let execution: TaskExecution;
    let isNewExecution = true;
    
    if (maxUses > 1) {
      // Buscar ejecución existente que aún tenga usos disponibles
      const lastExecution = await this.taskExecutionRepository.findLastByUserAndTask(
        effectiveUserId,
        params.taskId
      );

      if (lastExecution && (!lastExecution.currentUses || lastExecution.currentUses < maxUses)) {
        // Reutilizar la ejecución existente
        execution = lastExecution;
        execution.currentUses = (execution.currentUses || 0) + 1;
        isNewExecution = false;
      } else {
        // Crear nueva ejecución (usando effectiveUserId para globales)
        execution = {
          id: uuidv4(),
          taskId: params.taskId,
          userId: effectiveUserId,
          guildId: params.guildId,
          channelId: params.channelId,
          startedAt: new Date(),
          status: task.durationMinutes === 0 ? TaskExecutionStatus.COMPLETED : TaskExecutionStatus.RUNNING,
          currentUses: 1,
          createdAt: new Date()
        };
      }
    } else {
      // Tarea de un solo uso (usando effectiveUserId para globales)
      execution = {
        id: uuidv4(),
        taskId: params.taskId,
        userId: effectiveUserId,
        guildId: params.guildId,
        channelId: params.channelId,
        startedAt: new Date(),
        status: task.durationMinutes === 0 ? TaskExecutionStatus.COMPLETED : TaskExecutionStatus.RUNNING,
        currentUses: 1,
        createdAt: new Date()
      };
    }

    // Si es tarea instantánea (duración 0), marcar como completada inmediatamente
    if (task.durationMinutes === 0) {
      const now = new Date();
      execution.completedAt = now;
      
      // Si ya usó todos los usos, aplicar cooldown
      if (execution.currentUses! >= maxUses) {
        const cooldownEndTime = new Date(now.getTime() + task.cooldownMinutes * 60 * 1000);
        execution.availableAt = cooldownEndTime;
        
        // Programar notificación de cooldown terminado
        if (task.cooldownMinutes > 0) {
          this.schedulerPort.scheduleTaskCompletion(`cooldown_${execution.id}`, cooldownEndTime);
        }
      }
    } else {
      // Tarea con duración - programar finalización
      const completionTime = new Date(Date.now() + task.durationMinutes * 60 * 1000);
      this.schedulerPort.scheduleTaskCompletion(execution.id, completionTime);

      // Programar notificaciones intermedias si están configuradas
      if (task.notificationIntervalMinutes && task.notificationIntervalMinutes > 0) {
        this.schedulePeriodicNotifications(
          execution,
          task,
          params.userId // Usar el userId real del usuario que inició la tarea
        );
      }
    }

    const savedExecution = await this.taskExecutionRepository.save(execution);

    // Registrar en auditoría solo si es nueva ejecución
    if (isNewExecution) {
      try {
        const userInfo = await this.getUserInfo(params.userId);
        let boardName = 'Desconocida';
        try {
          const board = await this.taskBoardRepository.findById(task.boardId);
          if (board) boardName = board.title;
        } catch { /* ignore */ }
        
        await this.auditLogService.logTaskStarted(userInfo, task, savedExecution, boardName);
      } catch (error) {
        Logger.error('Error registrando auditoría de tarea iniciada:', error);
      }
    }

    return savedExecution;
  }

  async checkStatus(params: CheckTaskStatusParams): Promise<UserTaskStatus> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new TaskNotFoundException(params.taskId);
    }

    const maxUses = task.maxUses || 1;

    // Buscar ejecución activa
    const activeExecution = await this.taskExecutionRepository.findActiveByUserAndTask(
      params.userId,
      params.taskId
    );

    if (activeExecution && activeExecution.status === TaskExecutionStatus.RUNNING) {
      const elapsed = Date.now() - new Date(activeExecution.startedAt).getTime();
      const remainingMs = (task.durationMinutes * 60 * 1000) - elapsed;
      const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      return {
        userId: params.userId,
        taskId: params.taskId,
        status: TaskExecutionStatus.RUNNING,
        remainingDurationMinutes: remainingMinutes,
        remainingDurationSeconds: remainingSeconds,
        currentUses: activeExecution.currentUses || 1,
        remainingUses: maxUses - (activeExecution.currentUses || 1)
      };
    }

    // Buscar última ejecución completada
    const lastExecution = await this.taskExecutionRepository.findLastByUserAndTask(
      params.userId,
      params.taskId
    );

    if (lastExecution && lastExecution.completedAt) {
      const currentUses = lastExecution.currentUses || 1;
      
      // Si aún tiene usos disponibles, está AVAILABLE
      if (currentUses < maxUses && !lastExecution.availableAt) {
        return {
          userId: params.userId,
          taskId: params.taskId,
          status: TaskExecutionStatus.AVAILABLE,
          currentUses: currentUses,
          remainingUses: maxUses - currentUses
        };
      }

      // Verificar cooldown
      if (lastExecution.availableAt) {
        const cooldownEndTime = new Date(lastExecution.availableAt).getTime();
        const now = Date.now();

        if (now < cooldownEndTime) {
          const remainingCooldownMs = cooldownEndTime - now;
          const remainingCooldownMinutes = Math.ceil(remainingCooldownMs / 60000);
          const remainingCooldownSeconds = Math.ceil(remainingCooldownMs / 1000);

          return {
            userId: params.userId,
            taskId: params.taskId,
            status: TaskExecutionStatus.ON_COOLDOWN,
            remainingCooldownMinutes: remainingCooldownMinutes,
            remainingCooldownSeconds: remainingCooldownSeconds,
            nextAvailableAt: new Date(cooldownEndTime),
            currentUses: currentUses,
            remainingUses: 0
          };
        }
      }
    }

    return {
      userId: params.userId,
      taskId: params.taskId,
      status: TaskExecutionStatus.AVAILABLE,
      currentUses: 0,
      remainingUses: maxUses
    };
  }

  async completeTask(taskExecutionId: string): Promise<void> {
    const execution = await this.taskExecutionRepository.findById(taskExecutionId);
    if (!execution) {
      Logger.info(`Ejecución ${taskExecutionId} no encontrada para completar - probablemente fue reseteada`);
      return;
    }

    // Verificar si la ejecución fue reseteada
    const now = new Date();
    const availableAt = execution.availableAt ? new Date(execution.availableAt) : null;
    const completedAt = execution.completedAt ? new Date(execution.completedAt) : null;
    
    if (availableAt && completedAt && availableAt <= now) {
      const timeDiff = Math.abs(availableAt.getTime() - completedAt.getTime());
      if (timeDiff < 5000) {
        Logger.info(`Ejecución ${taskExecutionId} fue reseteada manualmente - omitiendo completado`);
        return;
      }
    }

    const task = await this.taskRepository.findById(execution.taskId);
    if (!task) {
      return;
    }

    // El cooldown corre EN PARALELO con la duración, no después
    // availableAt = startedAt + max(durationMinutes, cooldownMinutes)
    const maxTimeMs = Math.max(task.durationMinutes, task.cooldownMinutes) * 60 * 1000;
    const cooldownEndTime = new Date(execution.startedAt.getTime() + maxTimeMs);

    execution.completedAt = now;
    execution.availableAt = cooldownEndTime;
    execution.status = TaskExecutionStatus.COMPLETED;

    await this.taskExecutionRepository.update(execution);

    // Calcular el tiempo de cooldown RESTANTE desde AHORA hasta availableAt
    // Esto es más preciso que calcular desde startedAt
    const remainingMs = cooldownEndTime.getTime() - now.getTime();
    const formattedCooldown = remainingMs > 0
      ? TimeFormatter.formatMillisecondsWithSeconds(remainingMs)
      : 'Disponible ahora';

    // Programar notificación cuando el cooldown termine completamente
    if (remainingMs > 0) {
      this.schedulerPort.scheduleTaskCompletion(
        `cooldown_${taskExecutionId}`,
        cooldownEndTime
      );
    }

    // Obtener el nombre de la lista/taskboard
    let boardName = 'Desconocida';
    try {
      const board = await this.taskBoardRepository.findById(task.boardId);
      if (board) {
        boardName = board.title;
      }
    } catch (error) {
      Logger.error('Error obteniendo nombre del board:', error);
    }

    // Crear embed bonito para el DM
    const cooldownDisplay = remainingMs > 0 
      ? TimeFormatter.formatMillisecondsWithSeconds(remainingMs)
      : '0s';

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('✅ ¡Tarea Completada!')
      .setDescription(`¡Ya acabó tu tarea de **${task.name}**!`)
      .addFields(
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '⏳ Próxima disponibilidad', value: formattedCooldown, inline: true },
        { name: '📊 Cooldown restante', value: cooldownDisplay, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: '¡Bien hecho!' });
    
    // Obtener info del usuario para auditoría
    const userInfo = await this.getUserInfo(execution.userId);

    // Registrar en auditoría - Tarea Terminada (Duración)
    try {
      await this.auditLogService.logTaskCompleted(userInfo, task, execution, boardName, remainingMs);
    } catch (error) {
      Logger.error('Error registrando auditoría de tarea terminada:', error);
    }

    // Enviar DM al usuario
    let dmSuccess = true;
    let dmError: string | undefined;
    try {
      await this.notificationPort.sendDirectMessageEmbed(execution.userId, embed);
    } catch (error) {
      dmSuccess = false;
      dmError = error instanceof Error ? error.message : String(error);
      Logger.error(`Error enviando DM al usuario ${execution.userId}:`, error);
    }

    // Registrar en auditoría - DM Enviado
    try {
      await this.auditLogService.logDmSent(userInfo, 'TAREA_COMPLETADA', task, boardName, dmSuccess, dmError);
    } catch (error) {
      Logger.error('Error registrando auditoría de DM:', error);
    }
  }

  async notifyCooldownComplete(taskExecutionId: string): Promise<void> {
    // Remover el prefijo "cooldown_" si existe
    const actualId = taskExecutionId.replace('cooldown_', '');
    
    const execution = await this.taskExecutionRepository.findById(actualId);
    if (!execution) {
      Logger.info(`Ejecución ${actualId} no encontrada para notificación de cooldown - probablemente fue eliminada`);
      return;
    }

    // Verificar si la tarea fue reseteada (availableAt está en el pasado muy cercano a completedAt)
    const now = new Date();
    const availableAt = execution.availableAt ? new Date(execution.availableAt) : null;
    const completedAt = execution.completedAt ? new Date(execution.completedAt) : null;
    
    // Si availableAt está en el pasado y es muy cercano a completedAt (menos de 5 segundos de diferencia),
    // significa que fue reseteada manualmente y no debemos enviar notificación
    if (availableAt && completedAt && availableAt <= now) {
      const timeDiff = Math.abs(availableAt.getTime() - completedAt.getTime());
      if (timeDiff < 5000) { // Menos de 5 segundos de diferencia
        Logger.info(`Ejecución ${actualId} fue reseteada manualmente - omitiendo notificación de cooldown`);
        return;
      }
    }

    const task = await this.taskRepository.findById(execution.taskId);
    if (!task) {
      return;
    }

    const isGlobal = task.isGlobal || false;

    // Obtener el nombre de la lista/taskboard
    let boardName = 'Desconocida';
    try {
      const board = await this.taskBoardRepository.findById(task.boardId);
      if (board) {
        boardName = board.title;
      }
    } catch (error) {
      Logger.error('Error obteniendo nombre del board:', error);
    }

    // Obtener info del usuario para auditoría
    const userInfo = await this.getUserInfo(execution.userId);

    // Registrar en auditoría - Cooldown Terminado
    try {
      await this.auditLogService.logCooldownCompleted(userInfo, task, execution, boardName);
    } catch (error) {
      Logger.error('Error registrando auditoría de cooldown terminado:', error);
    }

    // Si es tarea global, enviar mensaje público con @here
    if (isGlobal && execution.channelId) {
      try {
        const channel = await this.client.channels.fetch(execution.channelId);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🌍 ¡Tarea Global Disponible!')
            .setDescription(`@here\n\nLa tarea **${task.name}** de la lista **${boardName}** ya está disponible nuevamente`)
            .addFields(
              { name: '🎯 Tarea', value: task.name, inline: true },
              { name: '⏱️ Duración', value: TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Este mensaje se borrará en 1 hora' });
          
          const publicMessage = await channel.send({ 
            content: '@here',
            embeds: [embed] 
          });
          
          // Borrar mensaje después de 1 hora
          setTimeout(async () => {
            try {
              await publicMessage.delete();
            } catch (error) {
              Logger.error('Error borrando mensaje de cooldown global completado:', error);
            }
          }, 60 * 60 * 1000); // 1 hora
        }
      } catch (error) {
        Logger.error('Error enviando mensaje público de cooldown global:', error);
      }
      
      // No enviar DM para tareas globales
      return;
    }

    // Para tareas personales, enviar DM como antes
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('✅ ¡Tarea Disponible!')
      .setDescription(`Tu tarea de la Lista **${boardName}** ya está disponible nuevamente`)
      .addFields(
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '⏱️ Duración', value: TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: '¡Puedes empezar cuando quieras!' });
    
    // Enviar DM al usuario
    let dmSuccess = true;
    let dmError: string | undefined;
    try {
      await this.notificationPort.sendDirectMessageEmbed(execution.userId, embed);
    } catch (error) {
      dmSuccess = false;
      dmError = error instanceof Error ? error.message : String(error);
      Logger.error(`Error enviando DM de cooldown completo al usuario ${execution.userId}:`, error);
    }

    // Registrar en auditoría - DM Enviado
    try {
      await this.auditLogService.logDmSent(userInfo, 'COOLDOWN_TERMINADO', task, boardName, dmSuccess, dmError);
    } catch (error) {
      Logger.error('Error registrando auditoría de DM:', error);
    }
  }

  async resetTask(params: {
    userId: string;
    taskId: string;
    resetBy: string;
    guildId: string;
  }): Promise<{ success: boolean; message: string }> {
    const task = await this.taskRepository.findById(params.taskId);
    if (!task) {
      throw new TaskNotFoundException(params.taskId);
    }

    // Buscar ejecución activa o en cooldown
    const activeExecution = await this.taskExecutionRepository.findActiveByUserAndTask(
      params.userId,
      params.taskId
    );

    const lastExecution = await this.taskExecutionRepository.findLastByUserAndTask(
      params.userId,
      params.taskId
    );

    let executionToReset: TaskExecution | null = null;

    if (activeExecution && activeExecution.status === TaskExecutionStatus.RUNNING) {
      executionToReset = activeExecution;
    } else if (lastExecution && lastExecution.status === TaskExecutionStatus.COMPLETED) {
      // Verificar si está en cooldown
      if (lastExecution.availableAt && new Date(lastExecution.availableAt).getTime() > Date.now()) {
        executionToReset = lastExecution;
      }
    }

    if (!executionToReset) {
      return {
        success: false,
        message: 'El usuario no tiene ninguna ejecución activa o en cooldown para esta tarea.'
      };
    }

    // Cancelar schedulers pendientes ANTES de actualizar el estado
    if (executionToReset.id) {
      Logger.info(`Cancelando schedulers para ejecución ${executionToReset.id}`);
      this.schedulerPort.cancelScheduledTask(executionToReset.id);
      this.schedulerPort.cancelScheduledTask(`cooldown_${executionToReset.id}`);
      Logger.info(`Schedulers cancelados para ejecución ${executionToReset.id}`);
    }

    // Marcar la ejecución como cancelada y disponible inmediatamente
    // Ponemos availableAt en el pasado para asegurar que esté disponible
    const now = new Date();
    executionToReset.status = TaskExecutionStatus.COMPLETED;
    executionToReset.completedAt = now;
    executionToReset.availableAt = new Date(now.getTime() - 1000); // 1 segundo en el pasado
    await this.taskExecutionRepository.update(executionToReset);

    // Obtener información del board
    let boardName = 'Desconocida';
    try {
      const board = await this.taskBoardRepository.findById(task.boardId);
      if (board) {
        boardName = board.title;
      }
    } catch (error) {
      Logger.error('Error obteniendo board para reset:', error);
    }

    // Obtener información del usuario
    const userInfo = await this.getUserInfo(params.userId);

    // Registrar en auditoría
    try {
      await this.auditLogService.logTaskReset(
        userInfo,
        task,
        boardName,
        params.resetBy,
        executionToReset.id
      );
    } catch (error) {
      Logger.error('Error registrando auditoría de reset:', error);
    }

    // Enviar DM al usuario
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 Tarea Reiniciada')
      .setDescription(`Tu tarea de **${task.name}** ha sido reiniciada por un administrador.`)
      .addFields(
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: '¡Puedes iniciarla de nuevo!' });

    let dmSuccess = true;
    let dmError: string | undefined;
    try {
      await this.notificationPort.sendDirectMessageEmbed(params.userId, embed);
    } catch (error) {
      dmSuccess = false;
      dmError = error instanceof Error ? error.message : String(error);
      Logger.error(`Error enviando DM de reset al usuario ${params.userId}:`, error);
    }

    // Registrar DM en auditoría
    try {
      await this.auditLogService.logDmSent(userInfo, 'TAREA_REINICIADA', task, boardName, dmSuccess, dmError);
    } catch (error) {
      Logger.error('Error registrando auditoría de DM de reset:', error);
    }

    return {
      success: true,
      message: `Tarea "${task.name}" reiniciada exitosamente para el usuario.`
    };
  }

  async resetAllTasks(): Promise<{
    cancelledExecutions: number;
    affectedUsers: number;
    tasksReset: number;
  }> {
    let cancelledExecutions = 0;
    let affectedUsers = 0;
    let tasksReset = 0;

    // Obtener todas las ejecuciones activas o en cooldown
    const allExecutions = await this.taskExecutionRepository.findAll();
    const userSet = new Set<string>();
    const taskSet = new Set<string>();

    const now = new Date();
    const pastDate = new Date(now.getTime() - 1000); // 1 segundo en el pasado

    for (const execution of allExecutions) {
      const shouldReset = 
        execution.status === TaskExecutionStatus.RUNNING ||
        (execution.status === TaskExecutionStatus.COMPLETED && 
         execution.availableAt && 
         new Date(execution.availableAt).getTime() > Date.now());

      if (shouldReset) {
        // Cancelar schedulers
        if (execution.id) {
          this.schedulerPort.cancelScheduledTask(execution.id);
          this.schedulerPort.cancelScheduledTask(`cooldown_${execution.id}`);
        }

        // Marcar como disponible
        execution.status = TaskExecutionStatus.COMPLETED;
        execution.completedAt = now;
        execution.availableAt = pastDate;
        await this.taskExecutionRepository.update(execution);

        cancelledExecutions++;
        userSet.add(execution.userId);
        taskSet.add(execution.taskId);
      }
    }

    affectedUsers = userSet.size;
    tasksReset = taskSet.size;

    Logger.info(`Reset completo: ${cancelledExecutions} ejecuciones canceladas, ${affectedUsers} usuarios afectados, ${tasksReset} tareas`);

    return {
      cancelledExecutions,
      affectedUsers,
      tasksReset
    };
  }

  async findExecutionById(executionId: string): Promise<TaskExecution | null> {
    return this.taskExecutionRepository.findById(executionId);
  }
}
