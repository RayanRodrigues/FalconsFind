export class InvalidItemDataError extends Error {
  constructor() {
    super(
      'This item was incorrectly reported. If this was your report, please submit it again or contact Campus Security.',
    );
    this.name = 'InvalidItemDataError';
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super('Item not found');
    this.name = 'ItemNotFoundError';
  }
}

export class ItemStatusConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemStatusConflictError';
  }
}

export class ItemStatusRestoreNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemStatusRestoreNotAllowedError';
  }
}
