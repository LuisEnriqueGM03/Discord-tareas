import { INotificationPort } from '../../domain/ports/out/INotificationPort';
import { ButtonInteraction, EmbedBuilder } from 'discord.js';

export class NotificationService {
  constructor(
    private readonly notificationPort: INotificationPort
  ) {}

  async sendTaskStartedMessage(
    interaction: ButtonInteraction,
    taskName: string,
    durationMinutes: number,
    cooldownMinutes: number
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ ¡Tarea Iniciada!')
      .setDescription(`Tu tarea de **${taskName}** ha comenzado`)
      .addFields(
        { name: '⏱️ Duración', value: `${durationMinutes} minutos`, inline: true },
        { name: '⏳ Cooldown', value: `${cooldownMinutes} minutos`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: '¡Buena suerte!' });
    
    await this.notificationPort.sendEphemeralEmbed(interaction, embed);
  }

  async sendTaskInProgressMessage(
    interaction: ButtonInteraction,
    taskName: string,
    remainingMinutes: number
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('🔄 Tarea en Progreso')
      .setDescription(`Tu tarea de **${taskName}** está activa`)
      .addFields(
        { name: '⏱️ Tiempo Restante', value: `${remainingMinutes} minutos`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '¡Sigue así!' });
    
    await this.notificationPort.sendEphemeralEmbed(interaction, embed);
  }

  async sendTaskOnCooldownMessage(
    interaction: ButtonInteraction,
    taskName: string,
    remainingTime: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xFF5555)
      .setTitle('⏳ Tarea en Cooldown')
      .setDescription(`La tarea **${taskName}** ya fue completada`)
      .addFields(
        { name: '🕐 Disponible en', value: remainingTime, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '¡Ten paciencia!' });
    
    await this.notificationPort.sendEphemeralEmbed(interaction, embed);
  }

  async sendTaskCompletedDM(
    userId: string,
    taskName: string,
    cooldownTime: string,
    cooldownMinutes: number
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✅ ¡Tarea Completada!')
      .setDescription(`¡Ya acabó tu tarea de **${taskName}**!`)
      .addFields(
        { name: '⏳ Próxima disponibilidad', value: cooldownTime, inline: true },
        { name: '📊 Cooldown restante', value: `${cooldownMinutes} minutos`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: '¡Bien hecho!' });
    
    await this.notificationPort.sendDirectMessageEmbed(userId, embed);
  }

  async sendTaskProgressNotification(
    userId: string,
    taskName: string,
    elapsedHours: number,
    isFinalWarning: boolean = false
  ): Promise<void> {
    const title = isFinalWarning ? '⚠️ ¡Tarea por Finalizar!' : '🔔 Notificación de Progreso';
    const description = isFinalWarning 
      ? `Tu tarea de **${taskName}** está por terminar en **10 minutos**`
      : `Han pasado **${elapsedHours} horas** desde que iniciaste **${taskName}**`;
    
    const embed = new EmbedBuilder()
      .setColor(isFinalWarning ? 0xFF9900 : 0x00CCFF)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ text: isFinalWarning ? '¡Prepárate!' : '¡Sigue adelante!' });
    
    await this.notificationPort.sendDirectMessageEmbed(userId, embed);
  }
}
