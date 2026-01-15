import { TimeFormatter } from '../../../src/infrastructure/utils/TimeFormatter';

describe('TimeFormatter', () => {
  describe('formatMinutes', () => {
    it('should format minutes less than 60', () => {
      expect(TimeFormatter.formatMinutes(30)).toBe('30 minutos');
      expect(TimeFormatter.formatMinutes(1)).toBe('1 minuto');
    });

    it('should format exact hours', () => {
      expect(TimeFormatter.formatMinutes(60)).toBe('1 hora');
      expect(TimeFormatter.formatMinutes(120)).toBe('2 horas');
    });

    it('should format hours and minutes', () => {
      expect(TimeFormatter.formatMinutes(90)).toBe('1 hora y 30 minutos');
      expect(TimeFormatter.formatMinutes(150)).toBe('2 horas y 30 minutos');
    });
  });

  describe('getRemainingMinutes', () => {
    it('should return 0 for past dates', () => {
      const pastDate = new Date(Date.now() - 60000);
      expect(TimeFormatter.getRemainingMinutes(pastDate)).toBe(0);
    });

    it('should return positive minutes for future dates', () => {
      const futureDate = new Date(Date.now() + 120000);
      const remaining = TimeFormatter.getRemainingMinutes(futureDate);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(2);
    });
  });
});
