import { Client, Events, Interaction, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ButtonInteractionHandler } from '../handlers/ButtonInteractionHandler';
import { CreateBoardCommand, ResetTaskCommand, ResetAllTasksCommand, ListTasksCommand, HelpCommand, ViewUserTasksCommand, MyTasksCommand } from '../commands';
import { Logger } from '../../../../utils/Logger';

export class InteractionCreateEvent {
  constructor(
    private readonly client: Client,
    private readonly buttonHandler: ButtonInteractionHandler,
    private readonly commands: {
      [key: string]: CreateBoardCommand | ResetTaskCommand | ResetAllTasksCommand | ListTasksCommand | HelpCommand | ViewUserTasksCommand | MyTasksCommand;
    }
  ) {}

  register(): void {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        if (interaction.isButton()) {
          await this.buttonHandler.handle(interaction);
        } else if (interaction.isChatInputCommand()) {
          await this.handleCommand(interaction);
        }
      } catch (error) {
        Logger.error('Error handling interaction:', error);
      }
    });
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands[interaction.commandName];

    if (!command) {
      Logger.warn(`Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      Logger.error(`Error executing command ${interaction.commandName}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: `❌ Ocurrió un error: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Ocurrió un error: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
}
