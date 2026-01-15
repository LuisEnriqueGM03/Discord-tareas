import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
import { Logger } from '../../../../utils/Logger';

export class ResetTaskCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('reset-task')
    .setDescription('Reiniciar una tarea activa de un usuario')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('El usuario al que se le reiniciará la tarea')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('task-id')
        .setDescription('El UUID de la tarea a reiniciar (ej: 32421ed3-68ed-4d63-89fe-4f446661318c)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('usuario');
    const taskId = interaction.options.getString('task-id');

    if (!targetUser || !taskId) {
      await interaction.reply({
        content: '❌ Debes proporcionar un usuario y el UUID de la tarea.',
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Buscar la tarea por UUID
      const task = await this.taskService.findById(taskId);

      if (!task) {
        await interaction.editReply({
          content: `❌ No se encontró ninguna tarea con el UUID "${taskId}".`
        });
        return;
      }

      // Reiniciar la tarea
      const result = await this.taskExecutionService.resetTask({
        userId: targetUser.id,
        taskId: task.id,
        resetBy: interaction.user.id,
        guildId: interaction.guildId || ''
      });

      if (!result.success) {
        await interaction.editReply({
          content: `⚠️ ${result.message}`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Tarea Reiniciada')
        .addFields(
          { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
          { name: '🎯 Tarea', value: task.name, inline: true },
          { name: '👮 Reiniciado por', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

      Logger.info(`Task "${task.name}" reset for user ${targetUser.tag} by ${interaction.user.tag}`);
    } catch (error) {
      Logger.error('Error resetting task:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al reiniciar la tarea: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al reiniciar la tarea: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
