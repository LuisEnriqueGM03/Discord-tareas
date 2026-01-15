import { TaskExecutionStatus } from '../../../src/domain/enums/TaskExecutionStatus';
import { ButtonStyle } from '../../../src/domain/enums/ButtonStyle';

describe('Domain Enums', () => {
  describe('TaskExecutionStatus', () => {
    it('should have all required statuses', () => {
      expect(TaskExecutionStatus.RUNNING).toBe('RUNNING');
      expect(TaskExecutionStatus.COMPLETED).toBe('COMPLETED');
      expect(TaskExecutionStatus.ON_COOLDOWN).toBe('ON_COOLDOWN');
      expect(TaskExecutionStatus.AVAILABLE).toBe('AVAILABLE');
    });
  });

  describe('ButtonStyle', () => {
    it('should have all required styles', () => {
      expect(ButtonStyle.Primary).toBe('Primary');
      expect(ButtonStyle.Secondary).toBe('Secondary');
      expect(ButtonStyle.Success).toBe('Success');
      expect(ButtonStyle.Danger).toBe('Danger');
    });
  });
});
