import { Client, ButtonInteraction, EmbedBuilder } from 'discord.js';
import { INotificationPort } from '../../../../domain/ports/out/INotificationPort';
import { Logger } from '../../../utils/Logger';

export class DiscordNotificationAdapter implements INotificationPort {
  constructor(private readonly client: Client) { }

  async sendDirectMessage(userId: string, message: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      if (user) {
        await user.send(message);
        Logger.info(`DM sent to user ${userId}`);
      }
    } catch (error) {
      Logger.error(`Failed to send DM to user ${userId}:`, error);
      throw error;
    }
  }

  async sendDirectMessageEmbed(userId: string, embed: EmbedBuilder): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      if (user) {
        await user.send({ embeds: [embed] });
        Logger.info(`DM embed sent to user ${userId}`);
      }
    } catch (error) {
      Logger.error(`Failed to send DM embed to user ${userId}:`, error);
      throw error;
    }
  }

  async sendEphemeralReply(interaction: ButtonInteraction, message: string): Promise<void> {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: message,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true
        });
      }
    } catch (error) {
      Logger.error('Failed to send ephemeral reply:', error);
      throw error;
    }
  }

  async sendEphemeralEmbed(interaction: ButtonInteraction, embed: EmbedBuilder): Promise<void> {
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [embed]
        });
      } else if (!interaction.replied) {
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          embeds: [embed],
          ephemeral: true
        });
      }
    } catch (error) {
      Logger.error('Failed to send ephemeral embed:', error);
      throw error;
    }
  }

  async sendChannelMessageWithAutoDelete(channelId: string, embed: EmbedBuilder, deleteAfterMs: number): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        const message = await channel.send({ embeds: [embed] });

        if (deleteAfterMs > 0) {
          setTimeout(async () => {
            try {
              await message.delete();
            } catch (error) {
              Logger.error(`Failed to delete message in channel ${channelId}:`, error);
            }
          }, deleteAfterMs);
        }
      }
    } catch (error) {
      Logger.error(`Failed to send auto-delete message to channel ${channelId}:`, error);
      // No lanzamos error para no interrumpir el flujo principal si falla un mensaje efímero
    }
  }
}
