import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { TaskBoardService } from '../../../../../application/services/TaskBoardService';
import { Logger } from '../../../../utils/Logger';

export class ListTasksCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('list-tasks')
    .setDescription('Listar todas las tareas con sus UUIDs');

  constructor(private readonly taskBoardService: TaskBoardService) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      const boards = await this.taskBoardService.loadAll();

      if (boards.length === 0) {
        await interaction.editReply({
          content: '❌ No hay tableros de tareas configurados.'
        });
        return;
      }

      const embeds: EmbedBuilder[] = [];

      for (const board of boards) {
        const embed = new EmbedBuilder()
          .setColor(parseInt(board.color.replace('#', ''), 16))
          .setTitle(`📋 ${board.title}`)
          .setDescription(board.description || 'Sin descripción');

        if (board.tasks && board.tasks.length > 0) {
          for (const task of board.tasks) {
            const maxUses = task.maxUses || 1;
            const isInstant = task.durationMinutes === 0;
            
            let taskInfo = `**UUID:** \`${task.id}\`\n`;
            taskInfo += `⏱️ Duración: ${isInstant ? 'Instantánea' : `${task.durationMinutes}m`}\n`;
            taskInfo += `⏳ Cooldown: ${task.cooldownMinutes}m\n`;
            if (maxUses > 1) {
              taskInfo += `🔢 Usos: ${maxUses}\n`;
            }
            
            embed.addFields({
              name: `${task.emoji || '📌'} ${task.name}`,
              value: taskInfo,
              inline: false
            });
          }
        } else {
          embed.addFields({
            name: 'Sin tareas',
            value: 'Este tablero no tiene tareas configuradas.',
            inline: false
          });
        }

        embeds.push(embed);
      }

      // Discord permite hasta 10 embeds por mensaje
      if (embeds.length > 10) {
        await interaction.editReply({
          content: '⚠️ Hay demasiados tableros. Mostrando los primeros 10.',
          embeds: embeds.slice(0, 10)
        });
      } else {
        await interaction.editReply({
          embeds: embeds
        });
      }

      Logger.info(`Task list requested by ${interaction.user.tag}`);
    } catch (error) {
      Logger.error('Error listing tasks:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al listar las tareas: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al listar las tareas: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
