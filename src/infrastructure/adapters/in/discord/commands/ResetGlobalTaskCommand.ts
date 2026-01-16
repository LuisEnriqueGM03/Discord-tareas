import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';
import { TaskService } from '../../../../../application/services/TaskService';
import { ITaskExecutionRepository } from '../../../../../domain/ports/out/ITaskExecutionRepository';
import { Logger } from '../../../../utils/Logger';

export class ResetGlobalTaskCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('reset-global-task')
    .setDescription('Reiniciar una tarea global usando su UUID de ejecución')
    .addStringOption(option =>
      option
        .setName('execution-id')
        .setDescription('El UUID de la ejecución de la tarea global')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskService: TaskService,
    private readonly taskExecutionRepository: ITaskExecutionRepository
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const executionId = interaction.options.getString('execution-id');

    if (!executionId) {
      await interaction.reply({
        content: '❌ Debes proporcionar el UUID de la ejecución.',
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Buscar la ejecución
      const execution = await this.taskExecutionService.findExecutionById(executionId);
      
      if (!execution) {
        await interaction.editReply({
          content: `❌ No se encontró ninguna ejecución con el UUID "${executionId}".`
        });
        return;
      }

      // Obtener la tarea
      const task = await this.taskService.findById(execution.taskId);
      
      if (!task) {
        await interaction.editReply({
          content: '❌ No se encontró la tarea asociada a esta ejecución.'
        });
        return;
      }

      // Verificar que sea una tarea global
      if (!task.isGlobal) {
        await interaction.editReply({
          content: '⚠️ Esta no es una tarea global. Para tareas personales usa `/reset-task`.'
        });
        return;
      }

      // Reiniciar la tarea global
      const result = await this.taskExecutionService.resetTask({
        userId: execution.userId,
        taskId: execution.taskId,
        resetBy: interaction.user.id,
        guildId: interaction.guildId || execution.guildId
      });

      if (!result.success) {
        await interaction.editReply({
          content: `⚠️ ${result.message}`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('✅ Tarea Global Reiniciada')
        .addFields(
          { name: '🌍 Tarea', value: task.name, inline: true },
          { name: '🔖 Execution ID', value: `\`${executionId}\``, inline: false },
          { name: '👮 Reiniciado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📊 Estado', value: 'La tarea global ha sido reiniciada y está disponible nuevamente', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Guild: ${execution.guildId}` });

      await interaction.editReply({ embeds: [embed] });
      
      Logger.info(`Tarea global ${task.name} (${executionId}) reiniciada por ${interaction.user.username}`);
    } catch (error) {
      Logger.error('Error en comando reset-global-task:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al reiniciar la tarea global: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al reiniciar la tarea global: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
