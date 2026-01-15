import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn 
} from 'typeorm';

@Entity('task_executions')
export class TaskExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'guild_id' })
  guildId: string;

  @Column({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'available_at', nullable: true })
  availableAt?: Date;

  @Column()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
