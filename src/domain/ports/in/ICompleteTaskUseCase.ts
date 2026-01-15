export interface ICompleteTaskUseCase {
  execute(taskExecutionId: string): Promise<void>;
}
