export class TaskOnCooldownException extends Error {
  public remainingMinutes: number;

  constructor(taskName: string, remainingMinutes: number) {
    super(`La tarea "${taskName}" está en cooldown. Vuelve en ${remainingMinutes} minutos`);
    this.name = 'TaskOnCooldownException';
    this.remainingMinutes = remainingMinutes;
  }
}
