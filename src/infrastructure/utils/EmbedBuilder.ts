import { 
  EmbedBuilder as DiscordEmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { TaskBoard } from '../../domain/models/TaskBoard';
import { Task } from '../../domain/models/Task';
import { ColorValidator } from './ColorValidator';
import { ButtonStyle as DomainButtonStyle } from '../../domain/enums/ButtonStyle';
import { TimeFormatter } from './TimeFormatter';

export class TaskBoardEmbedBuilder {
  static buildFromBoard(board: TaskBoard): DiscordEmbedBuilder {
    const embed = new DiscordEmbedBuilder()
      .setTitle(board.title)
      .setDescription(`${board.description}\n\n━━━━━━━━━━━━━━━━━━━━━━`)
      .setColor(ColorValidator.hexToDecimal(board.color))
      .setTimestamp();

    // Agregar campos de tareas con mejor formato
    board.tasks.forEach((task, index) => {
      const maxUses = task.maxUses || 1;
      const isMultiUse = maxUses > 1;
      const isInstant = task.durationMinutes === 0;
      const isGlobal = task.isGlobal || false;
      
      let taskInfo = '';
      
      // Duración
      if (isInstant) {
        taskInfo += `⚡ **Duración:** Instantánea\n`;
      } else {
        taskInfo += `⏱️ **Duración:** ${TimeFormatter.formatMillisecondsWithSeconds(task.durationMinutes * 60 * 1000)}\n`;
      }
      
      // Cooldown
      taskInfo += `⏳ **Cooldown:** ${TimeFormatter.formatMillisecondsWithSeconds(task.cooldownMinutes * 60 * 1000)}`;
      
      // Multi-Uso
      if (isMultiUse) {
        taskInfo += `\n🔢 **Multi-Uso:** ${maxUses} veces`;
      }
      
      // Global
      if (isGlobal) {
        taskInfo += `\n🌍 **GLOBAL:** Para todo el servidor`;
      }
      
      // Agregar separador al final si no es la última tarea
      if (index < board.tasks.length - 1) {
        taskInfo += `\n━━━━━━━━━━━━━━━━━━━━━━`;
      }

      embed.addFields({
        name: `${task.emoji || '📌'} ${task.name}`,
        value: taskInfo,
        inline: false
      });
    });

    // Footer con hora actualizada
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    embed.setFooter({ 
      text: `Sistema de Tareas v1.0 • hoy a las ${timeStr}` 
    });

    return embed;
  }

  static buildButtonRows(tasks: Task[]): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (const task of tasks) {
      if (buttonCount >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
        buttonCount = 0;
      }

      const button = new ButtonBuilder()
        .setCustomId(`task_${task.id}`)
        .setLabel(task.name)
        .setStyle(this.mapButtonStyle(task.buttonStyle));

      if (task.emoji) {
        button.setEmoji(task.emoji);
      }

      currentRow.addComponents(button);
      buttonCount++;
    }

    if (buttonCount > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  private static mapButtonStyle(style: DomainButtonStyle): ButtonStyle {
    switch (style) {
      case DomainButtonStyle.Primary:
        return ButtonStyle.Primary;
      case DomainButtonStyle.Secondary:
        return ButtonStyle.Secondary;
      case DomainButtonStyle.Success:
        return ButtonStyle.Success;
      case DomainButtonStyle.Danger:
        return ButtonStyle.Danger;
      default:
        return ButtonStyle.Primary;
    }
  }

  private static formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  }
}
