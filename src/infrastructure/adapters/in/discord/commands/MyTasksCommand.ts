import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
import { TaskBoardService } from '../../../../../application/services/TaskBoardService';
import { TaskExecutionStatus } from '../../../../../domain/enums/TaskExecutionStatus';
import { TimeFormatter } from '../../../../utils/TimeFormatter';
import { Logger } from '../../../../utils/Logger';

export class MyTasksCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('mis-tareas')
    .setDescription('Ver todas tus tareas activas y en cooldown');

  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService,
    private readonly taskBoardService: TaskBoardService
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });

      const tasks = await this.taskService.findAll();
      const boards = await this.taskBoardService.loadAll();
      
      const activeTasks = [];
      const cooldownTasks = [];

      for (const task of tasks) {
        // Excluir tareas globales de "mis tareas"
        if (task.isGlobal) {
          continue;
        }
        
        const status = await this.taskExecutionService.checkStatus({
          userId: interaction.user.id,
          taskId: task.id
        });

        if (status.status === TaskExecutionStatus.RUNNING) {
          const board = boards.find(b => b.id === task.boardId);
          activeTasks.push({ task, status, board });
        } else if (status.status === TaskExecutionStatus.ON_COOLDOWN) {
          const board = boards.find(b => b.id === task.boardId);
          cooldownTasks.push({ task, status, board });
        }
      }

      if (activeTasks.length === 0 && cooldownTasks.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x8B4513)
          .setTitle('📊 Mis Tareas')
          .setDescription('━━━━━━━━━━━━━━━━━━━━━━\n\n✅ **No tienes tareas activas ni en cooldown**\n\n¡Todas tus tareas están disponibles!\n\n━━━━━━━━━━━━━━━━━━━━━━')
          .setTimestamp()
          .addFields(
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '👤 Usuario', value: `${interaction.user.displayName}\n\`${interaction.user.tag}\`\n<@${interaction.user.id}>`, inline: true },
            { name: '🆔 ID de Usuario', value: `\`${interaction.user.id}\``, inline: true },
            { name: '⏰ Consultado', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: 'Usa los botones de las listas para iniciar tareas' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle('📊 Mis Tareas')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━')
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      // Tareas en ejecución
      if (activeTasks.length > 0) {
        embed.addFields({
          name: '🔄 Tareas en Ejecución',
          value: '━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        });

        for (const { task, status, board } of activeTasks) {
          const remainingMs = (status.remainingDurationSeconds || 0) * 1000;
          const timeStr = TimeFormatter.formatMillisecondsWithSeconds(remainingMs);
          const boardName = board?.title || 'Desconocida';
          const maxUses = task.maxUses || 1;
          const isInstant = task.durationMinutes === 0;
          
          let taskInfo = `**Lista:** ${boardName}\n`;
          if (isInstant) {
            taskInfo += '**Tipo:** ⚡ Instantánea\n';
          } else {
            taskInfo += `**Termina en:** ⏱️ ${timeStr}\n`;
          }
          if (maxUses > 1) {
            taskInfo += `**Usos:** 🔢 ${status.currentUses}/${maxUses} (${status.remainingUses} restantes)\n`;
          }
          
          embed.addFields({
            name: `${task.emoji || '📌'} ${task.name}`,
            value: taskInfo,
            inline: false
          });
        }
        
        embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
      }

      // Tareas en cooldown
      if (cooldownTasks.length > 0) {
        embed.addFields({
          name: '⏸️ Tareas en Cooldown',
          value: '━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        });

        for (const { task, status, board } of cooldownTasks) {
          const remainingMs = (status.remainingCooldownSeconds || 0) * 1000;
          const timeStr = TimeFormatter.formatMillisecondsWithSeconds(remainingMs);
          const boardName = board?.title || 'Desconocida';
          const maxUses = task.maxUses || 1;
          
          let taskInfo = `**Lista:** ${boardName}\n`;
          taskInfo += `**Disponible en:** ⏳ ${timeStr}\n`;
          if (maxUses > 1) {
            taskInfo += `**Usos consumidos:** 🔢 ${status.currentUses}/${maxUses}\n`;
          }
          if (status.nextAvailableAt) {
            taskInfo += `**Fecha:** 📅 <t:${Math.floor(new Date(status.nextAvailableAt).getTime() / 1000)}:F>\n`;
          }
          
          embed.addFields({
            name: `${task.emoji || '📌'} ${task.name}`,
            value: taskInfo,
            inline: false
          });
        }
        
        embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
      }

      // Información del usuario al final
      embed.addFields(
        { name: '━━━━━━━━━━━━━━━━━━━━━━', value: '\u200B', inline: false },
        { name: '👤 Usuario', value: `${interaction.user.displayName}\n\`${interaction.user.tag}\`\n<@${interaction.user.id}>`, inline: true },
        { name: '🆔 ID de Usuario', value: `\`${interaction.user.id}\``, inline: true },
        { name: '📊 Total Activas', value: `${activeTasks.length + cooldownTasks.length} tareas`, inline: true }
      );

      const totalActive = activeTasks.length + cooldownTasks.length;
      embed.setFooter({ 
        text: `${activeTasks.length} en ejecución • ${cooldownTasks.length} en cooldown • Total: ${totalActive}` 
      });

      await interaction.editReply({ embeds: [embed] });

      Logger.info(`User ${interaction.user.tag} viewed their tasks`);
    } catch (error) {
      Logger.error('Error viewing my tasks:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al ver tus tareas: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al ver tus tareas: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
