import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { Logger } from '../../../../utils/Logger';

export class HelpCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Muestra ayuda sobre los comandos disponibles');

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📚 Comandos del Bot de Tareas')
        .setDescription('Aquí están todos los comandos disponibles:')
        .addFields(
          {
            name: '📋 /list-tasks',
            value: 'Lista todas las tareas con sus UUIDs. Usa este comando para obtener el UUID de una tarea antes de resetearla.',
            inline: false
          },
          {
            name: '🔄 /reset-task',
            value: '**Uso:** `/reset-task usuario:@Usuario task-id:UUID`\n' +
                   'Reinicia una tarea activa de un usuario y le envía un DM.\n' +
                   '**Ejemplo:** `/reset-task usuario:@Juan task-id:32421ed3-68ed-4d63-89fe-4f446661318c`\n' +
                   '*(Solo administradores)*',
            inline: false
          },
          {
            name: '🎯 Iniciar Tareas',
            value: 'Haz clic en los botones de las listas de tareas para iniciar una tarea.',
            inline: false
          },
          {
            name: '⏰ Formato de Tiempo',
            value: 'Los tiempos se muestran en formato: `Xd Xh Xm Xs`\n' +
                   '• **d** = días\n' +
                   '• **h** = horas\n' +
                   '• **m** = minutos\n' +
                   '• **s** = segundos',
            inline: false
          },
          {
            name: '🔢 Tareas Multi-Uso',
            value: 'Algunas tareas permiten múltiples usos antes del cooldown. El sistema muestra cuántos usos te quedan.',
            inline: false
          },
          {
            name: '⚡ Tareas Instantáneas',
            value: 'Las tareas marcadas como "Instantánea" se completan inmediatamente pero tienen cooldown.',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: '💡 Usa /list-tasks para ver los UUIDs de las tareas' });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      Logger.info(`Help command used by ${interaction.user.tag}`);
    } catch (error) {
      Logger.error('Error showing help:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      await interaction.reply({
        content: `❌ Error al mostrar la ayuda: ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}
