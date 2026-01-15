import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  TextChannel 
} from 'discord.js';
import { TaskBoardService } from '../../../../../application/services/TaskBoardService';
import { TaskBoardEmbedBuilder } from '../../../../utils/EmbedBuilder';
import { Logger } from '../../../../utils/Logger';

export class CreateBoardCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('createboard')
    .setDescription('Crear una nueva mesa de tareas desde un archivo de configuración')
    .addStringOption(option =>
      option
        .setName('config')
        .setDescription('Ruta al archivo de configuración JSON')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  constructor(private readonly taskBoardService: TaskBoardService) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const configPath = interaction.options.getString('config');

    if (!configPath) {
      await interaction.reply({
        content: '❌ Debes proporcionar la ruta al archivo de configuración.',
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      const board = await this.taskBoardService.loadFromConfigFile(configPath);

      // Desplegar el board en el canal
      const channel = await interaction.client.channels.fetch(board.channelId);
      
      if (!channel || !(channel instanceof TextChannel)) {
        await interaction.editReply({
          content: `❌ No se encontró el canal ${board.channelId} o no es un canal de texto.`
        });
        return;
      }

      const embed = TaskBoardEmbedBuilder.buildFromBoard(board);
      const buttonRows = TaskBoardEmbedBuilder.buildButtonRows(board.tasks);

      const message = await channel.send({
        embeds: [embed],
        components: buttonRows
      });

      board.messageId = message.id;

      await interaction.editReply({
        content: `✅ Mesa de tareas "${board.title}" creada exitosamente en <#${board.channelId}>`
      });

      Logger.info(`Board "${board.title}" created by ${interaction.user.tag}`);
    } catch (error) {
      Logger.error('Error creating board:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Error al crear la mesa de tareas: ${errorMessage}`
        });
      } else {
        await interaction.reply({
          content: `❌ Error al crear la mesa de tareas: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
