import { Client, Events, TextChannel } from 'discord.js';
import { TaskBoard } from '../../../../../domain/models/TaskBoard';
import { TaskBoardService } from '../../../../../application/services/TaskBoardService';
import { TaskBoardEmbedBuilder } from '../../../../utils/EmbedBuilder';
import { Logger } from '../../../../utils/Logger';

export class ReadyEvent {
  constructor(
    private readonly client: Client,
    private readonly taskBoardService: TaskBoardService,
    private readonly configPath: string
  ) {}

  register(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      Logger.info(`Bot logged in as ${readyClient.user.tag}`);
      await this.loadAndDeployBoards();
    });
    
    // Si el cliente ya está listo, ejecutar inmediatamente
    if (this.client.isReady()) {
      Logger.info(`Bot logged in as ${this.client.user.tag}`);
      this.loadAndDeployBoards().catch(error => {
        Logger.error('Error in immediate board loading:', error);
      });
    }
  }

  private async loadAndDeployBoards(): Promise<void> {
    try {
      // Cargar todos los boards desde la configuración
      const boards = await this.taskBoardService.loadAllFromConfigDirectory(this.configPath);
      
      Logger.info(`Loaded ${boards.length} task boards from config`);

      // Desplegar cada board en su canal
      for (const board of boards) {
        await this.deployBoard(board);
      }
    } catch (error) {
      Logger.error('Error loading and deploying boards:', error);
    }
  }

  private async deployBoard(board: TaskBoard): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(board.channelId);
      
      if (!channel || !(channel instanceof TextChannel)) {
        Logger.warn(`Channel ${board.channelId} not found or is not a text channel`);
        return;
      }

      const embed = TaskBoardEmbedBuilder.buildFromBoard(board);
      const buttonRows = TaskBoardEmbedBuilder.buildButtonRows(board.tasks);

      // Si ya existe un mensaje, intentar editarlo
      if (board.messageId) {
        try {
          const existingMessage = await channel.messages.fetch(board.messageId);
          await existingMessage.edit({
            embeds: [embed],
            components: buttonRows
          });
          Logger.info(`Updated existing board message in channel ${board.channelId}`);
          return;
        } catch {
          // Mensaje no encontrado, crear uno nuevo
          Logger.info('Previous message not found, creating new one');
        }
      }

      // Crear nuevo mensaje
      const message = await channel.send({
        embeds: [embed],
        components: buttonRows
      });

      // Actualizar el board con el messageId y guardarlo
      await this.taskBoardService.updateBoardMessageId(board.id, message.id);
      
      Logger.info(`Deployed board "${board.title}" to channel ${board.channelId}`);
    } catch (error) {
      Logger.error(`Error deploying board ${board.id}:`, error);
    }
  }
}
