import * as fs from 'fs';
import * as path from 'path';
import { TaskBoard } from '../../../../../domain/models/TaskBoard';
import { ITaskBoardRepository } from '../../../../../domain/ports/out/ITaskBoardRepository';

interface BoardsData {
  boards: TaskBoard[];
}

export class JsonTaskBoardRepository implements ITaskBoardRepository {
  private readonly filePath: string;
  private data: BoardsData;

  constructor(dataPath: string = './data') {
    this.filePath = path.resolve(dataPath, 'boards.json');
    this.ensureFileExists();
    this.data = this.loadData();
  }

  private ensureFileExists(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({ boards: [] }, null, 2));
    }
  }

  private loadData(): BoardsData {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      // Inicializar tasks como array vacío si no existe
      data.boards = data.boards.map((board: TaskBoard) => ({
        ...board,
        tasks: board.tasks || []
      }));
      return data;
    } catch {
      return { boards: [] };
    }
  }

  private saveData(): void {
    // No guardar las tasks en el archivo de boards (se guardan en tasks.json)
    const dataToSave = {
      boards: this.data.boards.map(board => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tasks, ...boardWithoutTasks } = board;
        return boardWithoutTasks;
      })
    };
    fs.writeFileSync(this.filePath, JSON.stringify(dataToSave, null, 2));
  }

  async findById(id: string): Promise<TaskBoard | null> {
    const board = this.data.boards.find(b => b.id === id);
    return board || null;
  }

  async findAll(): Promise<TaskBoard[]> {
    return this.data.boards;
  }

  async findByGuildId(guildId: string): Promise<TaskBoard[]> {
    return this.data.boards.filter(b => b.guildId === guildId);
  }

  async findByChannelId(channelId: string): Promise<TaskBoard | null> {
    const board = this.data.boards.find(b => b.channelId === channelId);
    return board || null;
  }

  async save(board: TaskBoard): Promise<TaskBoard> {
    const existingIndex = this.data.boards.findIndex(b => b.id === board.id);
    
    if (existingIndex >= 0) {
      this.data.boards[existingIndex] = board;
    } else {
      this.data.boards.push(board);
    }
    
    this.saveData();
    return board;
  }

  async update(board: TaskBoard): Promise<TaskBoard> {
    const index = this.data.boards.findIndex(b => b.id === board.id);
    if (index >= 0) {
      this.data.boards[index] = board;
      this.saveData();
    }
    return board;
  }

  async delete(id: string): Promise<void> {
    this.data.boards = this.data.boards.filter(b => b.id !== id);
    this.saveData();
  }
}
