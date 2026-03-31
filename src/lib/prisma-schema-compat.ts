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
  return isPrismaSchemaMismatchError(error) && /finishedAt/i.test(getErrorMessage(error));
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
