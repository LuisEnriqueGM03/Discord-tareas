import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../../../../../domain/models/Task';
import { ITaskRepository } from '../../../../../domain/ports/out/ITaskRepository';

interface TasksData {
  tasks: Task[];
}

export class JsonTaskRepository implements ITaskRepository {
  private readonly filePath: string;
  private data: TasksData;

  constructor(dataPath: string = './data') {
    this.filePath = path.resolve(dataPath, 'tasks.json');
    this.ensureFileExists();
    this.data = this.loadData();
  }

  private ensureFileExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ tasks: [] }, null, 2));
    }
  }

  private loadData(): TasksData {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { tasks: [] };
    }
  }

  private saveData(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.data.tasks.find(t => t.id === id);
    return task || null;
  }

  async findAll(): Promise<Task[]> {
    return this.data.tasks;
  }

  async save(task: Task): Promise<Task> {
    const existingIndex = this.data.tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      this.data.tasks[existingIndex] = task;
    } else {
      this.data.tasks.push(task);
    }
    
    this.saveData();
    return task;
  }

  async update(task: Task): Promise<Task> {
    const existingIndex = this.data.tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      this.data.tasks[existingIndex] = task;
      this.saveData();
    }
    
    return task;
  }

  async findByBoardId(boardId: string): Promise<Task[]> {
    return this.data.tasks.filter(t => t.boardId === boardId);
  }

  async delete(id: string): Promise<void> {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.saveData();
  }
}
