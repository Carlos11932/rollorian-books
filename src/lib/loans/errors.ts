export const LOAN_OWNERSHIP_VERIFICATION_UNAVAILABLE_MESSAGE = "Loan ownership and library verification are unavailable until the UserBook schema is updated";

export class LoanNotFoundError extends Error {
  constructor() { super("Loan not found"); }
}

export class LoanForbiddenError extends Error {
  constructor() { super("Not authorized for this loan"); }
}

export class LoanInvalidTransitionError extends Error {
  constructor(msg: string) { super(msg); }
}

export class LoanBookNotInLibraryError extends Error {
  constructor() { super("Book is not in the lender's library"); }
}

export class LoanBookNotOwnedError extends Error {
  constructor() { super("Lender does not own this book (ownershipStatus is not OWNED)"); }
}

export class LoanOwnershipVerificationUnavailableError extends Error {
  constructor() {
    super(LOAN_OWNERSHIP_VERIFICATION_UNAVAILABLE_MESSAGE);
  }
}

export class LoanSelfBorrowError extends Error {
  constructor() { super("Cannot create a loan with yourself"); }
}

export class LoanWriteConflictError extends Error {
  constructor(action = "complete this loan update") {
    super(`Could not ${action} because another loan update happened at the same time. Please retry.`);
  }
}
