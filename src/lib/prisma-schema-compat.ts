import { Prisma } from "@prisma/client";

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
  // Prisma 7 may use "(not available)" instead of the actual column name,
  // so also match that when the error is about a UserBook column.
  return /finishedAt/i.test(msg) || /\(not available\)/i.test(msg);
}

export function isMissingUserBookSchemaError(error: unknown): boolean {
  return isPrismaSchemaMismatchError(error) && /UserBook|userBook/i.test(getErrorMessage(error));
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
