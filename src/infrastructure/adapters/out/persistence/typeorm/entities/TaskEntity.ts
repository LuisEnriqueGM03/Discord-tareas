import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  ManyToOne, 
  JoinColumn 
} from 'typeorm';
import { TaskBoardEntity } from './TaskBoardEntity';

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ name: 'cooldown_minutes' })
  cooldownMinutes: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  emoji?: string;

  @Column({ name: 'button_style' })
  buttonStyle: string;

  @Column({ name: 'board_id' })
  boardId: string;

  @ManyToOne(() => TaskBoardEntity, board => board.tasks)
  @JoinColumn({ name: 'board_id' })
  board: TaskBoardEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
