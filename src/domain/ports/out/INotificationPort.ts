import { ButtonInteraction, EmbedBuilder } from 'discord.js';

export interface INotificationPort {
  sendDirectMessage(userId: string, message: string): Promise<void>;
  sendDirectMessageEmbed(userId: string, embed: EmbedBuilder): Promise<void>;
  sendEphemeralReply(interaction: ButtonInteraction, message: string): Promise<void>;
  sendEphemeralEmbed(interaction: ButtonInteraction, embed: EmbedBuilder): Promise<void>;
  sendChannelMessageWithAutoDelete(channelId: string, embed: EmbedBuilder, deleteAfterMs: number, content?: string): Promise<void>;
}
