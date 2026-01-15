import { Task } from './Task';

export interface TaskBoard {
  id: string;
  channelId: string;
  messageId?: string;
  guildId: string;
  title: string;
  description: string;
  color: string;
  tasks: Task[];
  createdAt: Date;
  updatedAt?: Date;
}
