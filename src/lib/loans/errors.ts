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
