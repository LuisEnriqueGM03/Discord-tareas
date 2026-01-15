export class TaskNotFoundException extends Error {
  constructor(taskId: string) {
    super(`Tarea no encontrada: ${taskId}`);
    this.name = 'TaskNotFoundException';
  }
}
