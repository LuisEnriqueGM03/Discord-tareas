import { ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
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
    private readonly notificationPort: INotificationPort
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
          const timeDisplay = `${minutes}m ${seconds}s`;

          const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('🔄 Tarea en Progreso')
            .setDescription(`Tu tarea de **${task.name}** está activa`)
            .addFields(
              { name: '⏱️ Tiempo Restante', value: timeDisplay, inline: false }
            );

          if (maxUses > 1) {
            embed.addFields(
              { name: '🔢 Usos', value: `${status.currentUses || 1}/${maxUses}`, inline: true }
            );
          }

          embed.setTimestamp()
            .setFooter({ text: '¡Sigue así!' });
          
          await this.sendEphemeralResponse(interaction, embed);
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
            const embed = new EmbedBuilder()
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
            // Tarea personal - ephemeral como antes
            const embed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('✅ ¡Tarea Iniciada!')
              .setDescription(`Tu tarea de **${task.name}** ha comenzado`);

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

            embed.setTimestamp()
              .setFooter({ text: '¡Buena suerte! • Puedes descartar este mensaje cuando quieras' });
            
            await this.sendEphemeralResponse(interaction, embed);
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
