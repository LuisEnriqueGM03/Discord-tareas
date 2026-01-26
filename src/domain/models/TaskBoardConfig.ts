export interface TaskBoardConfig {
  channelId: string;
  guildId: string;
  title: string;
  description: string;
  color: string;
  tasks: TaskConfig[];
}

export interface TaskConfig {
  name: string;
  durationMinutes: number;
  cooldownMinutes: number;
  description?: string;
  emoji?: string;
  buttonStyle: 'Primary' | 'Secondary' | 'Success' | 'Danger';
  maxUses?: number;
  isGlobal?: boolean;
  notificationIntervalMinutes?: number;
  earlyNotificationMinutes?: number;
}
