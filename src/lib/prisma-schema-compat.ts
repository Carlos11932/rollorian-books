import { Prisma } from "@prisma/client";

export class UserBookSchemaUnavailableError extends Error {
  constructor() {
    super("Library write operations are unavailable until the database schema includes UserBook");
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function isPrismaSchemaMismatchError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2021" || error.code === "P2022")
  );
}

export function isMissingFinishedAtError(error: unknown): boolean {
  if (!isPrismaSchemaMismatchError(error)) return false;
  const msg = getErrorMessage(error);
  return /finishedAt/i.test(msg);
}

export function isMissingUserBookSchemaError(error: unknown): boolean {
  return isPrismaSchemaMismatchError(error) && /UserBook|userBook/i.test(getErrorMessage(error));
}

export function isUserBookSchemaUnavailableError(error: unknown): error is UserBookSchemaUnavailableError {
  return error instanceof UserBookSchemaUnavailableError;
}

export function rethrowMissingUserBookSchemaError(error: unknown): void {
  if (isMissingUserBookSchemaError(error)) {
    throw new UserBookSchemaUnavailableError();
  }
}

export function isMissingListsSchemaError(error: unknown): boolean {
  return (
    isPrismaSchemaMismatchError(error)
    && /(BookList|bookList|BookListItem|bookListItem)/i.test(getErrorMessage(error))
  );
}

export function isMissingUserRoleError(error: unknown): boolean {
  return isPrismaSchemaMismatchError(error) && /role/i.test(getErrorMessage(error));
}

export function isMissingSocialSchemaError(error: unknown): boolean {
  return (
    isPrismaSchemaMismatchError(error)
    && /(Invitation|invitation|GroupMember|groupMember|Follow|follow)/i.test(getErrorMessage(error))
  );
}

export function isMissingDonnaStateSchemaError(error: unknown): boolean {
  return (
    isPrismaSchemaMismatchError(error)
    && /(DonnaBookState|donnaBookState|DonnaSemanticState|donnaSemanticState)/i.test(getErrorMessage(error))
  );
}

export function isMissingOwnershipStatusError(error: unknown): boolean {
  if (!isPrismaSchemaMismatchError(error)) return false;
  const msg = getErrorMessage(error);
  return /ownershipStatus|OwnershipStatus/i.test(msg);
}

/**
 * Catch-all for any schema mismatch on a column whose name Prisma
 * cannot resolve (shows as "(not available)" in Prisma 7).
 * Use ONLY as a last-resort fallback AFTER field-specific detectors fail.
 */
export function isGenericColumnMismatchError(error: unknown): boolean {
  if (!isPrismaSchemaMismatchError(error)) return false;
  return /\(not available\)/i.test(getErrorMessage(error));
}

export interface UserBookCompatAttempt {
  includeOwnershipStatus: boolean;
  includeFinishedAt: boolean;
}

type UserBookCompatField = keyof UserBookCompatAttempt;

export function isRetryableUserBookCompatError(error: unknown): boolean {
  return isPrismaSchemaMismatchError(error) || isGenericColumnMismatchError(error);
}

export function getUserBookCompatAttempts(
  initial: UserBookCompatAttempt,
): UserBookCompatAttempt[] {
  const attempts: UserBookCompatAttempt[] = [initial];

  if (initial.includeOwnershipStatus) {
    attempts.push({ ...initial, includeOwnershipStatus: false });
  }

  if (initial.includeFinishedAt) {
    attempts.push({ ...initial, includeFinishedAt: false });
  }

  if (initial.includeOwnershipStatus || initial.includeFinishedAt) {
    attempts.push({ includeOwnershipStatus: false, includeFinishedAt: false });
  }

  return attempts.filter((attempt, index, all) => (
    all.findIndex((candidate) => (
      candidate.includeOwnershipStatus === attempt.includeOwnershipStatus
      && candidate.includeFinishedAt === attempt.includeFinishedAt
    )) === index
  ));
}

function withoutCompatField(
  attempt: UserBookCompatAttempt,
  field: UserBookCompatField,
): UserBookCompatAttempt {
  return {
    ...attempt,
    [field]: false,
  };
}

export function getUserBookCompatFallbackAttempts(
  attempt: UserBookCompatAttempt,
  error: unknown,
): UserBookCompatAttempt[] {
  const prioritizedFields: UserBookCompatField[] = [];

  if (isMissingFinishedAtError(error) && attempt.includeFinishedAt) {
    prioritizedFields.push("includeFinishedAt");
  }

  if (isMissingOwnershipStatusError(error) && attempt.includeOwnershipStatus) {
    prioritizedFields.push("includeOwnershipStatus");
  }

  if (attempt.includeFinishedAt && !prioritizedFields.includes("includeFinishedAt")) {
    prioritizedFields.push("includeFinishedAt");
  }

  if (attempt.includeOwnershipStatus && !prioritizedFields.includes("includeOwnershipStatus")) {
    prioritizedFields.push("includeOwnershipStatus");
  }

  const attempts = prioritizedFields.map((field) => withoutCompatField(attempt, field));

  if (attempt.includeOwnershipStatus && attempt.includeFinishedAt) {
    attempts.push({ includeOwnershipStatus: false, includeFinishedAt: false });
  }

  return attempts.filter((candidate, index, all) => (
    all.findIndex((attemptOption) => (
      attemptOption.includeOwnershipStatus === candidate.includeOwnershipStatus
      && attemptOption.includeFinishedAt === candidate.includeFinishedAt
    )) === index
  ));
}
