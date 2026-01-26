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

  async sendIntervalTaskStartedMessage(
    interaction: ButtonInteraction,
    taskName: string,
    durationMinutes: number,
    intervalMinutes: number,
    earlyMinutes: number
  ): Promise<void> {
    const totalIntervals = Math.floor(durationMinutes / intervalMinutes);
    const firstNotificationTime = intervalMinutes - earlyMinutes;
    const now = new Date();
    const startTime = now.getTime();
    const firstNotificationDate = new Date(startTime + firstNotificationTime * 60 * 1000);
    const endTime = new Date(startTime + durationMinutes * 60 * 1000);

    const embed = new EmbedBuilder()
      .setColor(0x1E90FF)
      .setTitle('🎯 ¡Tarea con Intervalos Iniciada!')
      .setDescription(`Tu tarea de **${taskName}** ha comenzado con notificaciones programadas`)
      .addFields(
        { name: '🕰️ Momento actual', value: `<t:${Math.floor(startTime / 1000)}:F>`, inline: true },
        { name: '⏱️ Duración total', value: `${durationMinutes} minutos`, inline: true },
        { name: '🏁 Finaliza', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
        { name: '📊 Progreso', value: `0/${totalIntervals} intervalos`, inline: true },
        { name: '🎀 Intervalo cada', value: `${intervalMinutes} min`, inline: true },
        { name: '⚠️ Aviso anticipado', value: `${earlyMinutes} min`, inline: true },
        { name: '🔔 Próximo aviso', value: `<t:${Math.floor(firstNotificationDate.getTime() / 1000)}:R>`, inline: false },
        { name: '⏳ Cooldown', value: 'Sin cooldown', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '¡Estate atento a las notificaciones!' });
    
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

  async sendIntervalTaskInProgressMessage(
    interaction: ButtonInteraction,
    taskName: string,
    remainingMinutes: number,
    intervalMinutes: number,
    totalIntervals: number,
    elapsedMinutes: number
  ): Promise<void> {
    const currentInterval = Math.floor(elapsedMinutes / intervalMinutes) + 1;
    const nextIntervalTime = currentInterval * intervalMinutes;
    const minutesToNextInterval = nextIntervalTime - elapsedMinutes;
    const nextNotificationTime = nextIntervalTime - 1; // Restar 1 minuto del early notification
    const nextNotificationDate = new Date(Date.now() + minutesToNextInterval * 60 * 1000 - 60 * 1000);
    
    const embed = new EmbedBuilder()
      .setColor(0x1E90FF)
      .setTitle('🎯 Tarea con Intervalos en Progreso')
      .setDescription(`Tu tarea de **${taskName}** está activa con notificaciones por intervalos`)
      .addFields(
        { name: '🕰️ Momento actual', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '⏱️ Tiempo total restante', value: `${remainingMinutes} minutos`, inline: true },
        { name: '🏁 Finaliza', value: `<t:${Math.floor((Date.now() + remainingMinutes * 60 * 1000) / 1000)}:R>`, inline: true },
        { name: '📊 Progreso', value: `${Math.min(currentInterval, totalIntervals)}/${totalIntervals} intervalos`, inline: true },
        { name: '🎀 Intervalo cada', value: `${intervalMinutes} min`, inline: true },
        { name: '⚠️ Aviso anticipado', value: `1 min`, inline: true },
        { name: '🔔 Próximo aviso', value: `<t:${Math.floor(nextNotificationDate.getTime() / 1000)}:R>`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '¡Las notificaciones se envían automáticamente!' });
    
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
