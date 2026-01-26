export class DriverNotFoundError extends Error {
  constructor(id: string) {
    super(`Driver with id '${id}' not found`);
  }
}

export class ValidationError extends Error {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}
