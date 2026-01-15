import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany 
} from 'typeorm';
import { TaskEntity } from './TaskEntity';

@Entity('task_boards')
export class TaskBoardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  @Column({ name: 'message_id', nullable: true })
  messageId?: string;

  @Column({ name: 'guild_id' })
  guildId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  color: string;

  @OneToMany(() => TaskEntity, task => task.board)
  tasks: TaskEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
