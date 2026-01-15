export class InvalidBoardConfigException extends Error {
  constructor(message: string) {
    super(`Configuración de board inválida: ${message}`);
    this.name = 'InvalidBoardConfigException';
  }
}
