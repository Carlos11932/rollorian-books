export class LibraryEntryNotFoundError extends Error {
  constructor() {
    super("Book not found in library");
  }
}

export class DuplicateLibraryEntryError extends Error {
  constructor() {
    super("Book already in your library");
  }
}

export class InvalidStatusError extends Error {
  constructor(validStatuses: string[]) {
    super(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }
}
