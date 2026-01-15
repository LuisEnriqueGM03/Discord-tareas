import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { TaskExecutionService } from '../../../../../application/services/TaskExecutionService';

export class ResetAllTasksCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('reset-all-tasks')
    .setDescription('🔄 Reinicia TODAS las tareas de TODOS los usuarios (solo administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(
    private readonly taskExecutionService: TaskExecutionService
  ) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();

      // Ejecutar el reset completo
      const result = await this.taskExecutionService.resetAllTasks();

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Reset Completo Exitoso')
        .setDescription('Todas las tareas de todos los usuarios han sido reiniciadas')
        .addFields(
          { name: '🔄 Ejecuciones Canceladas', value: result.cancelledExecutions.toString(), inline: true },
          { name: '👥 Usuarios Afectados', value: result.affectedUsers.toString(), inline: true },
          { name: '📋 Tareas Reiniciadas', value: result.tasksReset.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Reiniciado por ${interaction.user.username}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(`Error al reiniciar todas las tareas: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }
}
