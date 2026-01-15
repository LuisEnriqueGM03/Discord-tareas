import { CommandInteraction } from 'discord.js';
import { Logger } from '../../../../utils/Logger';

export class CommandHandler {
  private commands: Map<string, (interaction: CommandInteraction) => Promise<void>> = new Map();

  registerCommand(
    name: string, 
    handler: (interaction: CommandInteraction) => Promise<void>
  ): void {
    this.commands.set(name, handler);
  }

  async handle(interaction: CommandInteraction): Promise<void> {
    const commandName = interaction.commandName;
    const handler = this.commands.get(commandName);

    if (!handler) {
      Logger.warn(`Unknown command: ${commandName}`);
      return;
    }

    try {
      await handler(interaction);
    } catch (error) {
      Logger.error(`Error executing command ${commandName}:`, error);
      
      const errorMessage = 'Ocurrió un error al ejecutar el comando.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
}
