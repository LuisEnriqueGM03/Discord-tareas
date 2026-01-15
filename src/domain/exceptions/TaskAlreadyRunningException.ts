export class TaskAlreadyRunningException extends Error {
  constructor(taskName: string, remainingMinutes: number) {
    super(`La tarea "${taskName}" ya está en ejecución. Tiempo restante: ${remainingMinutes} minutos`);
    this.name = 'TaskAlreadyRunningException';
  }
}
