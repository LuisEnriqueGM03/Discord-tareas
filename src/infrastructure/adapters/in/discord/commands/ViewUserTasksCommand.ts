import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
import { TaskBoardService } from '../../../../../application/services/TaskBoardService';
import { TaskExecutionStatus } from '../../../../../domain/enums/TaskExecutionStatus';
import { TimeFormatter } from '../../../../utils/TimeFormatter';
import { Logger } from '../../../../utils/Logger';

export class ViewUserTasksCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('ver-tareas')
    .setDescription('Ver todas las tareas activas de un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('El usuario del que quieres ver las tareas')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService,
    private readonly taskBoardService: TaskBoardService
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('usuario');

    if (!targetUser) {
      await interaction.reply({
        content: '❌ Debes proporcionar un usuario.',
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      const tasks = await this.taskService.findAll();
      const boards = await this.taskBoardService.loadAll();
      
      const activeTasks = [];
      const cooldownTasks = [];

      for (const task of tasks) {
        const status = await this.taskExecutionService.checkStatus({
          userId: targetUser.id,
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
        await interaction.editReply({
          content: `ℹ️ El usuario ${targetUser.tag} no tiene tareas activas ni en cooldown.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 Tareas de ${targetUser.displayName}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`Usuario: <@${targetUser.id}>\nID: \`${targetUser.id}\``)
        .setTimestamp();

      // Tareas en ejecución
      if (activeTasks.length > 0) {
        let runningText = '';
        for (const { task, status, board } of activeTasks) {
          const remainingMs = (status.remainingDurationSeconds || 0) * 1000;
          const timeStr = TimeFormatter.formatMillisecondsWithSeconds(remainingMs);
          const boardName = board?.title || 'Desconocida';
          const maxUses = task.maxUses || 1;
          
          runningText += `**${task.emoji || '📌'} ${task.name}**\n`;
          runningText += `📋 Lista: ${boardName}\n`;
          runningText += `⏱️ Tiempo restante: ${timeStr}\n`;
          if (maxUses > 1) {
            runningText += `🔢 Uso: ${status.currentUses}/${maxUses}\n`;
          }
          runningText += `🔖 ID: \`${task.id}\`\n\n`;
        }
        
        embed.addFields({
          name: '🔄 Tareas en Ejecución',
          value: runningText.trim(),
          inline: false
        });
      }

      // Tareas en cooldown
      if (cooldownTasks.length > 0) {
        let cooldownText = '';
        for (const { task, status, board } of cooldownTasks) {
          const remainingMs = (status.remainingCooldownSeconds || 0) * 1000;
          const timeStr = TimeFormatter.formatMillisecondsWithSeconds(remainingMs);
          const boardName = board?.title || 'Desconocida';
          const maxUses = task.maxUses || 1;
          
          cooldownText += `**${task.emoji || '📌'} ${task.name}**\n`;
          cooldownText += `📋 Lista: ${boardName}\n`;
          cooldownText += `⏳ Disponible en: ${timeStr}\n`;
          if (maxUses > 1) {
            cooldownText += `🔢 Usos consumidos: ${status.currentUses}/${maxUses}\n`;
          }
          if (status.nextAvailableAt) {
            cooldownText += `📅 Disponible: <t:${Math.floor(status.nextAvailableAt.getTime() / 1000)}:R>\n`;
          }
          cooldownText += `🔖 ID: \`${task.id}\`\n\n`;
        }
        
        embed.addFields({
          name: '⏸️ Tareas en Cooldown',
          value: cooldownText.trim(),
          inline: false
        });
      }

      embed.setFooter({ 
        text: `Total: ${activeTasks.length} en ejecución, ${cooldownTasks.length} en cooldown` 
      });

      await interaction.editReply({ embeds: [embed] });

      Logger.info(`Admin ${interaction.user.tag} viewed tasks for user ${targetUser.tag}`);
    } catch (error) {
      Logger.error('Error viewing user tasks:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al ver las tareas: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al ver las tareas: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
