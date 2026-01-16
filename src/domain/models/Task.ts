import { ButtonStyle } from '../enums/ButtonStyle';

export interface Task {
  id: string;
  name: string;
  durationMinutes: number; // 0 = instantánea
  cooldownMinutes: number;
  maxUses?: number; // Cuántas veces se puede usar antes del cooldown (default: 1)
  isGlobal?: boolean; // Si es true, el cooldown afecta a todos los usuarios
  notificationIntervalMinutes?: number; // Intervalo para notificaciones periódicas durante la tarea (ej: cada 3 horas = 180)
  earlyNotificationMinutes?: number; // Minutos antes de completarse para enviar la última notificación (ej: 10)
  description?: string;
  emoji?: string;
  buttonStyle: ButtonStyle;
  boardId: string;
  createdAt: Date;
}
