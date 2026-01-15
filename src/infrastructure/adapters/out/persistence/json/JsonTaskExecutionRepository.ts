import * as fs from 'fs';
import * as path from 'path';
import { TaskExecution } from '../../../../../domain/models/TaskExecution';
import { ITaskExecutionRepository } from '../../../../../domain/ports/out/ITaskExecutionRepository';
import { TaskExecutionStatus } from '../../../../../domain/enums/TaskExecutionStatus';

interface ExecutionsData {
  executions: TaskExecution[];
}

export class JsonTaskExecutionRepository implements ITaskExecutionRepository {
  private readonly filePath: string;
  private data: ExecutionsData;

  constructor(dataPath: string = './data') {
    this.filePath = path.resolve(dataPath, 'executions.json');
    this.ensureFileExists();
    this.data = this.loadData();
  }

  private ensureFileExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ executions: [] }, null, 2));
    }
  }

  private loadData(): ExecutionsData {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { executions: [] };
    }
  }

  private saveData(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async findActiveByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null> {
    const execution = this.data.executions.find(
      e => e.userId === userId && 
           e.taskId === taskId && 
           e.status === TaskExecutionStatus.RUNNING
    );
    return execution || null;
  }

  async findLastByUserAndTask(userId: string, taskId: string): Promise<TaskExecution | null> {
    const executions = this.data.executions
      .filter(e => e.userId === userId && e.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return executions[0] || null;
  }

  async save(execution: TaskExecution): Promise<TaskExecution> {
    this.data.executions.push(execution);
    this.saveData();
    return execution;
  }

  async findById(id: string): Promise<TaskExecution | null> {
    const execution = this.data.executions.find(e => e.id === id);
    return execution || null;
  }

  async update(execution: TaskExecution): Promise<TaskExecution> {
    const index = this.data.executions.findIndex(e => e.id === execution.id);
    if (index >= 0) {
      this.data.executions[index] = execution;
      this.saveData();
    }
    return execution;
  }

  async findAll(): Promise<TaskExecution[]> {
    return this.data.executions;
  }
}
