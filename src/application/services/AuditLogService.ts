import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Task } from '../../domain/models/Task';
import { TaskExecution } from '../../domain/models/TaskExecution';
import { Logger } from '../../infrastructure/utils/Logger';
import { TimeFormatter } from '../../infrastructure/utils/TimeFormatter';

export interface AuditLogChannels {
  tareasIniciadas?: string;
  tareasTerminadas?: string;
  cooldownTerminados?: string;
  dmMandados?: string;
  tareasReseteadas?: string;
}

export interface AuditUserInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export class AuditLogService {
  constructor(
    private readonly client: Client,
    private readonly channels: AuditLogChannels
  ) {}

  /**
   * Registra cuando un usuario inicia una tarea
   */
  async logTaskStarted(
    user: AuditUserInfo,
    task: Task,
    execution: TaskExecution,
    boardName: string
  ): Promise<void> {
    if (!this.channels.tareasIniciadas) return;

    const startTime = new Date(execution.startedAt);
    const endTime = new Date(startTime.getTime() + task.durationMinutes * 60 * 1000);
    const cooldownEndTime = new Date(startTime.getTime() + Math.max(task.durationMinutes, task.cooldownMinutes) * 60 * 1000);
    
    const maxUses = task.maxUses || 1;
    const currentUses = execution.currentUses || 1;
    const isInstant = task.durationMinutes === 0;
    const isGlobal = task.isGlobal || false;

    // Color azul para tareas globales, verde para personales
    const embedColor = isGlobal ? 0x0099FF : 0x00FF00;
    const embedTitle = isGlobal ? '🌍 Tarea Global Iniciada' : '🚀 Tarea Iniciada';

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(embedTitle)
      .setThumbnail(user.avatarUrl || null)
      .addFields(
        { name: '👤 Usuario', value: `${user.displayName}\n\`${user.username}\`\n<@${user.id}>`, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true }
      );

    // Agregar campo de tipo de tarea
    if (isGlobal) {
      embed.addFields({ name: '🌍 Tipo', value: '**GLOBAL**', inline: true });
    } else {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }

    // Verificar si es tarea con intervalos
    const hasIntervals = task.notificationIntervalMinutes && task.notificationIntervalMinutes > 0;

    if (isInstant) {
      embed.addFields(
        { name: '⚡ Tipo', value: 'Instantánea', inline: true },
        { name: '⏳ Cooldown', value: TimeFormatter.formatMillisecondsWithSeconds(task.cooldownMinutes * 60 * 1000), inline: true }
      );
    } else if (hasIntervals) {
      // Calcular cantidad de intervalos
      const totalIntervals = Math.floor(task.durationMinutes / task.notificationIntervalMinutes!);
      const notificationTimes: string[] = [];
      
      for (let i = 1; i <= totalIntervals; i++) {
        const intervalTime = i * task.notificationIntervalMinutes!;
        const notificationTime = intervalTime - (task.earlyNotificationMinutes || 0);
        if (notificationTime > 0) {
          notificationTimes.push(`${notificationTime}min`);
        }
      }
      
      embed.addFields(
        { name: '⏱️ Duración', value: TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000), inline: true },
        { name: '📢 Intervalos', value: `Cada ${task.notificationIntervalMinutes}min (${totalIntervals} total)`, inline: true },
        { name: '🔔 Avisos en', value: notificationTimes.join(', '), inline: true }
      );
    } else {
      embed.addFields(
        { name: '⏱️ Duración', value: TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000), inline: true },
        { name: '⏳ Cooldown', value: TimeFormatter.formatMillisecondsWithSeconds(task.cooldownMinutes * 60 * 1000), inline: true }
      );
    }

    if (maxUses > 1) {
      embed.addFields(
        { name: '🔢 Uso Actual', value: `${currentUses}/${maxUses}`, inline: true }
      );
    } else {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }

    embed.addFields(
      { name: '🕐 Hora de Inicio', value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>\n<t:${Math.floor(startTime.getTime() / 1000)}:R>`, inline: true }
    );

    if (!isInstant) {
      embed.addFields(
        { name: '🏁 Termina Duración', value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>\n<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
      );
    } else {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }

    // Para tareas con intervalos, no mostrar cooldown ya que no tienen
    if (hasIntervals) {
      embed.addFields(
        { name: '✅ Estado', value: 'Sin cooldown (intervalos activos)', inline: true }
      );
    } else if (currentUses >= maxUses) {
      embed.addFields(
        { name: '✅ Disponible Nuevamente', value: `<t:${Math.floor(cooldownEndTime.getTime() / 1000)}:F>\n<t:${Math.floor(cooldownEndTime.getTime() / 1000)}:R>`, inline: true }
      );
    } else {
      embed.addFields(
        { name: '🔄 Estado', value: `${maxUses - currentUses} usos restantes`, inline: true }
      );
    }

    embed.addFields(
      { name: '🔖 Execution ID', value: `\`${execution.id}\``, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `Guild: ${execution.guildId}` });

    await this.sendToChannel(this.channels.tareasIniciadas, embed);
  }

  /**
   * Registra cuando termina la duración de una tarea
   */
  async logTaskCompleted(
    user: AuditUserInfo,
    task: Task,
    execution: TaskExecution,
    boardName: string,
    remainingCooldownMs: number
  ): Promise<void> {
    if (!this.channels.tareasTerminadas) return;

    const startTime = new Date(execution.startedAt);
    const completedTime = new Date(execution.completedAt!);
    const availableTime = new Date(execution.availableAt!);
    
    const durationActual = Math.ceil((completedTime.getTime() - startTime.getTime()) / 60000);
    
    const maxUses = task.maxUses || 1;
    const currentUses = execution.currentUses || 1;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('✅ Tarea Terminada (Duración Completada)')
      .setThumbnail(user.avatarUrl || null)
      .addFields(
        { name: '👤 Usuario', value: `${user.displayName}\n\`${user.username}\`\n<@${user.id}>`, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🕐 Inició', value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>`, inline: true },
        { name: '🏁 Terminó', value: `<t:${Math.floor(completedTime.getTime() / 1000)}:F>`, inline: true },
        { name: '⏱️ Duración Real', value: `${durationActual} minutos`, inline: true }
      );

    if (maxUses > 1) {
      embed.addFields(
        { name: '🔢 Usos Consumidos', value: `${currentUses}/${maxUses}`, inline: true }
      );
    } else {
      embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
    }

    embed.addFields(
      { name: '⏳ Cooldown Restante', value: TimeFormatter.formatMillisecondsWithSeconds(remainingCooldownMs), inline: true },
      { name: '✅ Disponible en', value: `<t:${Math.floor(availableTime.getTime() / 1000)}:F>\n<t:${Math.floor(availableTime.getTime() / 1000)}:R>`, inline: true },
      { name: '🔖 Execution ID', value: `\`${execution.id}\``, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `Guild: ${execution.guildId}` });

    await this.sendToChannel(this.channels.tareasTerminadas, embed);
  }

  /**
   * Registra cuando termina el cooldown completamente
   */
  async logCooldownCompleted(
    user: AuditUserInfo,
    task: Task,
    execution: TaskExecution,
    boardName: string
  ): Promise<void> {
    if (!this.channels.cooldownTerminados) return;

    const startTime = new Date(execution.startedAt);
    const completedTime = new Date(execution.completedAt!);
    const availableTime = new Date(execution.availableAt!);
    const totalTime = Math.ceil((availableTime.getTime() - startTime.getTime()) / 60000);

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎉 Cooldown Terminado - Tarea Disponible')
      .setThumbnail(user.avatarUrl || null)
      .addFields(
        { name: '👤 Usuario', value: `${user.displayName}\n\`${user.username}\`\n<@${user.id}>`, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🕐 Inició Tarea', value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>`, inline: true },
        { name: '✅ Duración Terminó', value: `<t:${Math.floor(completedTime.getTime() / 1000)}:F>`, inline: true },
        { name: '🎊 Cooldown Terminó', value: `<t:${Math.floor(availableTime.getTime() / 1000)}:F>`, inline: true },
        { name: '⏱️ Tiempo Total', value: TimeFormatter.formatMillisecondsWithSeconds(totalTime * 60 * 1000), inline: true },
        { name: '📊 Estado', value: '`DISPONIBLE`', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🔖 Execution ID', value: `\`${execution.id}\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Guild: ${execution.guildId}` });

    await this.sendToChannel(this.channels.cooldownTerminados, embed);
  }

  /**
   * Registra cuando se envía un DM a un usuario
   */
  async logDmSent(
    user: AuditUserInfo,
    dmType: 'TAREA_COMPLETADA' | 'COOLDOWN_TERMINADO' | 'TAREA_REINICIADA',
    task: Task,
    boardName: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    if (!this.channels.dmMandados) return;

    const statusColor = success ? 0x000000 : 0xFF0000;
    const statusEmoji = success ? '✅' : '❌';
    const statusText = success ? 'Enviado Exitosamente' : 'Error al Enviar';

    let dmTypeText = '📬 Notificación';
    if (dmType === 'TAREA_COMPLETADA') {
      dmTypeText = '📬 Notificación de Tarea Completada';
    } else if (dmType === 'COOLDOWN_TERMINADO') {
      dmTypeText = '📬 Notificación de Cooldown Terminado';
    } else if (dmType === 'TAREA_REINICIADA') {
      dmTypeText = '🔄 Notificación de Tarea Reiniciada';
    }

    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle(`${statusEmoji} DM ${statusText}`)
      .setThumbnail(user.avatarUrl || null)
      .addFields(
        { name: '👤 Destinatario', value: `${user.displayName}\n\`${user.username}\`\n<@${user.id}>`, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📧 Tipo de DM', value: dmTypeText, inline: true },
        { name: '📊 Estado', value: `\`${statusText.toUpperCase()}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: success ? 'DM entregado correctamente' : 'El usuario puede tener DMs desactivados' });

    if (!success && errorMessage) {
      embed.addFields({ name: '⚠️ Error', value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``, inline: false });
    }

    await this.sendToChannel(this.channels.dmMandados, embed);
  }

  /**
   * Registra cuando un administrador reinicia una tarea de un usuario
   */
  async logTaskReset(
    user: AuditUserInfo,
    task: Task,
    boardName: string,
    resetById: string,
    executionId: string
  ): Promise<void> {
    // Usar canal dedicado de resets o fallback al de tareas iniciadas
    const targetChannel = this.channels.tareasReseteadas || this.channels.tareasIniciadas;
    if (!targetChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 Tarea Reiniciada por Administrador')
      .setThumbnail(user.avatarUrl || null)
      .addFields(
        { name: '👤 Usuario Afectado', value: `${user.displayName}\n\`${user.username}\`\n<@${user.id}>`, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📋 Lista', value: boardName, inline: true },
        { name: '🎯 Tarea', value: task.name, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '👮 Reiniciado por', value: `<@${resetById}>`, inline: true },
        { name: '⏰ Momento', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🔖 Execution ID', value: `\`${executionId}\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'La tarea ha sido reseteada. El usuario puede iniciarla nuevamente.' });

    await this.sendToChannel(targetChannel, embed);
  }

  /**
   * Registra cuando un administrador ejecuta reset de todas las tareas
   */
  async logAllTasksReset(
    resetById: string,
    resetByUsername: string,
    cancelledExecutions: number,
    affectedUsers: number,
    tasksReset: number,
    guildId: string
  ): Promise<void> {
    const targetChannel = this.channels.tareasReseteadas || this.channels.tareasIniciadas;
    if (!targetChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔄 RESET COMPLETO DE TODAS LAS TAREAS')
      .setDescription('Un administrador ha reiniciado TODAS las tareas de TODOS los usuarios')
      .addFields(
        { name: '👮 Ejecutado por', value: `<@${resetById}>\n\`${resetByUsername}\``, inline: true },
        { name: '⏰ Momento', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🔄 Ejecuciones Canceladas', value: cancelledExecutions.toString(), inline: true },
        { name: '👥 Usuarios Afectados', value: affectedUsers.toString(), inline: true },
        { name: '📋 Tareas Reiniciadas', value: tasksReset.toString(), inline: true },
        { name: '📊 Estado', value: 'Todas las tareas están disponibles nuevamente', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Guild: ${guildId}` });

    await this.sendToChannel(targetChannel, embed);
  }

  private async sendToChannel(channelId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel instanceof TextChannel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      Logger.error(`Error sending audit log to channel ${channelId}:`, error);
    }
  }
}
