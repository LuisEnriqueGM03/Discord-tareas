import { ColorValidator } from '../../../src/infrastructure/utils/ColorValidator';
import { InvalidBoardConfigException } from '../../../src/domain/exceptions/InvalidBoardConfigException';

describe('ColorValidator', () => {
  describe('isValidHexColor', () => {
    it('should return true for valid 6-digit hex colors', () => {
      expect(ColorValidator.isValidHexColor('#3498db')).toBe(true);
      expect(ColorValidator.isValidHexColor('#FFFFFF')).toBe(true);
      expect(ColorValidator.isValidHexColor('#000000')).toBe(true);
    });

    it('should return true for valid 3-digit hex colors', () => {
      expect(ColorValidator.isValidHexColor('#fff')).toBe(true);
      expect(ColorValidator.isValidHexColor('#000')).toBe(true);
    });

    it('should return false for invalid colors', () => {
      expect(ColorValidator.isValidHexColor('3498db')).toBe(false);
      expect(ColorValidator.isValidHexColor('#gggggg')).toBe(false);
      expect(ColorValidator.isValidHexColor('red')).toBe(false);
    });
  });

  describe('validateAndNormalize', () => {
    it('should normalize valid colors to uppercase', () => {
      expect(ColorValidator.validateAndNormalize('#3498db')).toBe('#3498DB');
    });

    it('should throw exception for invalid colors', () => {
      expect(() => ColorValidator.validateAndNormalize('invalid')).toThrow(InvalidBoardConfigException);
    });
  });

  describe('hexToDecimal', () => {
    it('should convert hex to decimal', () => {
      expect(ColorValidator.hexToDecimal('#FFFFFF')).toBe(16777215);
      expect(ColorValidator.hexToDecimal('#000000')).toBe(0);
      expect(ColorValidator.hexToDecimal('#3498db')).toBe(3447003);
    });
  });
});
