import { InvalidBoardConfigException } from '../../domain/exceptions/InvalidBoardConfigException';

export class ColorValidator {
  private static readonly HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

  static isValidHexColor(color: string): boolean {
    return this.HEX_COLOR_REGEX.test(color);
  }

  static validateAndNormalize(color: string): string {
    if (!this.isValidHexColor(color)) {
      throw new InvalidBoardConfigException(`Invalid hex color: ${color}`);
    }
    return color.toUpperCase();
  }

  static hexToDecimal(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }
}
