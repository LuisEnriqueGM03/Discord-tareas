import { TaskAlreadyRunningException } from '../../../src/domain/exceptions/TaskAlreadyRunningException';
import { TaskOnCooldownException } from '../../../src/domain/exceptions/TaskOnCooldownException';
import { TaskNotFoundException } from '../../../src/domain/exceptions/TaskNotFoundException';
import { InvalidBoardConfigException } from '../../../src/domain/exceptions/InvalidBoardConfigException';

describe('Domain Exceptions', () => {
  describe('TaskAlreadyRunningException', () => {
    it('should create exception with correct message', () => {
      const exception = new TaskAlreadyRunningException('Pescar', 30);
      expect(exception.message).toContain('Pescar');
      expect(exception.message).toContain('30');
      expect(exception.name).toBe('TaskAlreadyRunningException');
    });
  });

  describe('TaskOnCooldownException', () => {
    it('should create exception with correct message and remaining minutes', () => {
      const exception = new TaskOnCooldownException('Minar', 60);
      expect(exception.message).toContain('Minar');
      expect(exception.message).toContain('60');
      expect(exception.remainingMinutes).toBe(60);
      expect(exception.name).toBe('TaskOnCooldownException');
    });
  });

  describe('TaskNotFoundException', () => {
    it('should create exception with task id', () => {
      const exception = new TaskNotFoundException('task-123');
      expect(exception.message).toContain('task-123');
      expect(exception.name).toBe('TaskNotFoundException');
    });
  });

  describe('InvalidBoardConfigException', () => {
    it('should create exception with config error', () => {
      const exception = new InvalidBoardConfigException('Invalid color');
      expect(exception.message).toContain('Invalid color');
      expect(exception.name).toBe('InvalidBoardConfigException');
    });
  });
});
