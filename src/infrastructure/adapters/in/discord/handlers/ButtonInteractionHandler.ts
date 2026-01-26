import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
import { NotificationService } from '../../../../../application/services/NotificationService';
import { INotificationPort } from '../../../../../domain/ports/out/INotificationPort';
import { TaskExecutionStatus } from '../../../../../domain/enums/TaskExecutionStatus';
import { TaskAlreadyRunningException } from '../../../../../domain/exceptions/TaskAlreadyRunningException';
import { TaskOnCooldownException } from '../../../../../domain/exceptions/TaskOnCooldownException';
import { TaskNotFoundException } from '../../../../../domain/exceptions/TaskNotFoundException';
import { Logger } from '../../../../utils/Logger';
import { TimeFormatter } from '../../../../utils/TimeFormatter';

export class ButtonInteractionHandler {
  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService,
    private readonly notificationPort: INotificationPort,
    private readonly notificationService: NotificationService
  ) {}

  async handle(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    // Verificar si es un botón de tarea
    if (!customId.startsWith('task_')) {
      return;
    }

    const taskId = customId.replace('task_', '');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      try {
        await interaction.reply({ content: 'Este comando solo puede usarse en un servidor.', ephemeral: true });
      } catch (error) {
        Logger.error('Error sending guild error:', error);
      }
      return;
    }

    try {
      // Obtener información de la tarea PRIMERO para saber si es global
      const task = await this.taskService.findById(taskId);
      const isGlobal = task.isGlobal || false;

      // Para tareas personales, hacer defer ephemeral
      // Para tareas globales, NO hacer defer (responderemos directamente)
      if (!isGlobal) {
        try {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
          }
        } catch (error) {
          Logger.warn(`Error deferring reply for user ${userId}:`, error);
          return;
        }
      }

      // Para tareas globales, usar un userId especial
      const effectiveUserId = isGlobal ? `GLOBAL_${guildId}` : userId;

      // Verificar el estado actual de la tarea
      const status = await this.taskExecutionService.checkStatus({
        userId: effectiveUserId,
        taskId
      });

      const maxUses = task.maxUses || 1;

      switch (status.status) {
        case TaskExecutionStatus.RUNNING: {
          // Tarea en ejecución - mostrar tiempo restante
          const totalSeconds = status.remainingDurationSeconds || 0;
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          
          // Verificar si es tarea con intervalos
          const hasIntervals = task.notificationIntervalMinutes && task.notificationIntervalMinutes > 0;
          
          if (hasIntervals) {
            // Usar el método específico para tareas con intervalos
            // Calcular tiempo transcurrido = duración total - tiempo restante
            const totalMs = task.durationMinutes * 60 * 1000;
            const remainingMs = (status.remainingDurationSeconds || 0) * 1000;
            const elapsedMs = totalMs - remainingMs;
            const elapsedMinutes = elapsedMs / 60000;
            const totalIntervals = Math.floor(task.durationMinutes / (task.notificationIntervalMinutes || 1));
            
            await this.notificationService.sendIntervalTaskInProgressMessage(
              interaction,
              task.name,
              minutes,
              task.notificationIntervalMinutes || 1,
              totalIntervals,
              elapsedMinutes
            );
          } else {
            // Usar el método normal
            await this.notificationService.sendTaskInProgressMessage(
              interaction,
              task.name,
              minutes + (seconds > 0 ? 1 : 0) // Redondear hacia arriba si hay segundos
            );
          }
          break;
        }

        case TaskExecutionStatus.ON_COOLDOWN: {
          // Tarea en cooldown - mostrar tiempo restante
          const totalMs = (status.remainingCooldownSeconds || 0) * 1000;
          const timeDisplay = TimeFormatter.formatMillisecondsWithSeconds(totalMs);
          
          // Calcular fecha de disponibilidad
          const availableDate = new Date(Date.now() + totalMs);
          const dateOptions: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          };
          const formattedDate = availableDate.toLocaleDateString('es-ES', dateOptions);

          const embed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('⏳ Tarea en Cooldown')
            .setDescription(isGlobal 
              ? `La tarea **${task.name}** ya fue completada por alguien\n🌍 Esta es una tarea **GLOBAL** para todo el servidor`
              : `La tarea **${task.name}** ya fue completada`)
            .addFields(
              { name: '🕐 Disponible en', value: timeDisplay, inline: false },
              { name: '📅 Fecha', value: formattedDate, inline: false }
            );

          if (maxUses > 1) {
            embed.addFields(
              { name: '🔢 Usos Consumidos', value: `${status.currentUses || 0}/${maxUses}`, inline: true }
            );
          }

          embed.setTimestamp()
            .setFooter({ text: '¡Ten paciencia! • Puedes descartar este mensaje cuando quieras' });
          
          await this.sendEphemeralResponse(interaction, embed);
          break;
        }

        case TaskExecutionStatus.AVAILABLE: {
          // Verificar nuevamente el estado antes de iniciar (doble verificación)
          const doubleCheck = await this.taskExecutionService.checkStatus({
            userId: effectiveUserId,
            taskId
          });

          if (doubleCheck.status !== TaskExecutionStatus.AVAILABLE) {
            // El estado cambió entre la primera verificación y ahora
            Logger.warn(`Estado cambió para usuario ${userId} tarea ${taskId}: ${doubleCheck.status}`);
            
            let errorMessage = 'El estado de la tarea cambió. Intenta de nuevo.';
            if (doubleCheck.status === TaskExecutionStatus.RUNNING) {
              errorMessage = 'La tarea ya está en ejecución.';
            } else if (doubleCheck.status === TaskExecutionStatus.ON_COOLDOWN) {
              errorMessage = 'La tarea está en cooldown.';
            }
            
            await this.sendEphemeralError(interaction, errorMessage);
            return;
          }

          // Iniciar la tarea (guardando channelId para tareas globales)
          await this.taskExecutionService.execute({
            userId,
            taskId,
            guildId,
            channelId: isGlobal ? interaction.channelId : undefined
          });

          const isInstant = task.durationMinutes === 0;
          
          // Si es tarea global, enviar mensaje público que se borre en 1 hora
          if (isGlobal) {
            const hasIntervals = task.notificationIntervalMinutes && task.notificationIntervalMinutes > 0;
            
            let embed: EmbedBuilder;
            
            if (hasIntervals) {
              // Embed especial para tareas globales con intervalos
              const totalIntervals = Math.floor(task.durationMinutes / task.notificationIntervalMinutes!);
              const firstNotificationTime = task.notificationIntervalMinutes! - (task.earlyNotificationMinutes || 0);
              const startTime = Date.now();
              const firstNotificationDate = new Date(startTime + firstNotificationTime * 60 * 1000);
              const endTime = new Date(startTime + task.durationMinutes * 60 * 1000);
              
              embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌍 ¡Tarea Global con Intervalos Iniciada!')
                .setDescription(`**${task.name}** ha sido iniciada por ${interaction.user.displayName}`)
                .addFields(
                  { name: '🕰️ Momento actual', value: `<t:${Math.floor(startTime / 1000)}:F>`, inline: true },
                  { name: '⏱️ Duración total', value: `${task.durationMinutes} minutos`, inline: true },
                  { name: '🎯 Finaliza', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
                  { name: '📊 Progreso', value: `0/${totalIntervals} intervalos`, inline: true },
                  { name: '🎀 Intervalo cada', value: `${task.notificationIntervalMinutes} min`, inline: true },
                  { name: '⚠️ Aviso anticipado', value: `${task.earlyNotificationMinutes || 0} min`, inline: true },
                  { name: '🔔 Primer aviso', value: `<t:${Math.floor(firstNotificationDate.getTime() / 1000)}:R>`, inline: false },
                  { name: '⏳ Cooldown', value: 'Sin cooldown', inline: false }
                );
            } else {
              // Embed normal para tareas globales sin intervalos
              embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🌍 ¡Tarea Global Iniciada!')
                .setDescription(`**${task.name}** ha sido completada por ${interaction.user.displayName}`);

              if (isInstant) {
                embed.addFields(
                  { name: '⚡ Tipo', value: 'Instantánea', inline: true },
                  { name: '⏳ Cooldown', value: TimeFormatter.formatMillisecondsWithSeconds(task.cooldownMinutes * 60 * 1000), inline: true }
                );
              } else {
                embed.addFields(
                  { name: '⏱️ Duración', value: TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000), inline: true },
                  { name: '⏳ Cooldown', value: TimeFormatter.formatMillisecondsWithSeconds(task.cooldownMinutes * 60 * 1000), inline: true }
                );
              }

              if (maxUses > 1) {
                embed.addFields(
                  { name: '🔢 Usos Disponibles', value: `${status.remainingUses || maxUses}/${maxUses}`, inline: true }
                );
              }
            }
            
            embed.setTimestamp()
              .setFooter({ text: 'Este mensaje se borrará en 1 hora' });
            
            // Enviar mensaje público directamente (sin canal.send)
            const publicMessage = await interaction.reply({ 
              content: '@here', 
              embeds: [embed],
              fetchReply: true 
            });
            
            // Programar borrado en 1 hora
            setTimeout(async () => {
              try {
                if (publicMessage && 'delete' in publicMessage) {
                  await publicMessage.delete();
                }
              } catch (error) {
                Logger.error('Error borrando mensaje público de tarea global:', error);
              }
            }, 60 * 60 * 1000); // 1 hora
          } else {
            // Tarea personal - usar NotificationService
            const hasIntervals = task.notificationIntervalMinutes && task.notificationIntervalMinutes > 0;
            
            if (hasIntervals) {
              // Usar el método específico para tareas con intervalos
              await this.notificationService.sendIntervalTaskStartedMessage(
                interaction,
                task.name,
                task.durationMinutes,
                task.notificationIntervalMinutes || 1,
                task.earlyNotificationMinutes || 0
              );
            } else {
              // Usar el método normal
              await this.notificationService.sendTaskStartedMessage(
                interaction,
                task.name,
                task.durationMinutes,
                task.cooldownMinutes
              );
            }
          }
          break;
        }
      }
    } catch (error) {
      if (error instanceof TaskNotFoundException) {
        await this.sendEphemeralError(interaction, 'La tarea no fue encontrada.');
      } else if (error instanceof TaskAlreadyRunningException) {
        await this.sendEphemeralError(interaction, error.message);
      } else if (error instanceof TaskOnCooldownException) {
        await this.sendEphemeralError(interaction, error.message);
      } else {
        Logger.error('Error handling button interaction:', error);
        await this.sendEphemeralError(interaction, 'Ocurrió un error al procesar tu solicitud.');
      }
    }
  }

  private async sendEphemeralError(interaction: ButtonInteraction, message: string): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(message)
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else if (!interaction.replied) {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      Logger.error('Error sending ephemeral error:', error);
    }
  }

  private async sendEphemeralResponse(interaction: ButtonInteraction, embed: EmbedBuilder): Promise<void> {
    try {
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else if (!interaction.replied) {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      Logger.error('Error sending ephemeral response:', error);
    }
  }
}
