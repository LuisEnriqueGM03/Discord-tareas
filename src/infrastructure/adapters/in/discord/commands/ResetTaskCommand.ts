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
        .setDescription('El UUID de la tarea o ejecución a reiniciar')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('usuario');
    const inputId = interaction.options.getString('task-id');

    if (!targetUser || !inputId) {
      await interaction.reply({
        content: '❌ Debes proporcionar un usuario y el UUID de la tarea o ejecución.',
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Primero intentar encontrar por execution ID
      let taskId: string | undefined;
      
      try {
        const execution = await this.taskExecutionService.findExecutionById(inputId);
        if (execution && execution.userId === targetUser.id) {
          taskId = execution.taskId;
        }
      } catch (error) {
        // No es un execution ID válido, intentar como task ID
      }

      // Si no se encontró como execution ID, intentar como task ID
      if (!taskId) {
        try {
          const task = await this.taskService.findById(inputId);
          if (task) {
            taskId = task.id;
          }
        } catch (error) {
          await interaction.editReply({
            content: `❌ No se encontró ninguna tarea o ejecución con el UUID "${inputId}".`
          });
          return;
        }
      }

      // Obtener la tarea para mostrar su nombre
      const task = await this.taskService.findById(taskId!);

      // Reiniciar la tarea
      const result = await this.taskExecutionService.resetTask({
        userId: targetUser.id,
        taskId: taskId!,
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
