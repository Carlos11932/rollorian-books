import "server-only";

import { prisma } from "@/lib/prisma";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import type { DonnaBookRef, ReadingEventRequest } from "./contracts";
import {
  normalizeTitle,
  normalizeAuthorSet,
  normalizeEntry,
  getDonnaStateMap,
  type SelectedUserBook,
  type NormalizedLibraryEntry,
} from "./normalize";
import { getDonnaUserContext } from "./user";

type ResolveMatchStatus = "exact" | "strong" | "ambiguous" | "none";

export type ResolveBookResult = {
  matchStatus: ResolveMatchStatus;
  matchedBook: NormalizedLibraryEntry | null;
  suggestions: NormalizedLibraryEntry[];
};

export function rankTitleCandidate(
  candidate: SelectedUserBook,
  ref: DonnaBookRef,
  ownedBookIds: Set<string>,
): number {
  let score = 0;
  const refTitle = ref.title ? normalizeTitle(ref.title) : "";
  const candidateTitle = normalizeTitle(candidate.book.title);

  if (refTitle && candidateTitle === refTitle) {
    score += 50;
  } else if (refTitle && candidateTitle.includes(refTitle)) {
    score += 25;
  }

  const refAuthors = normalizeAuthorSet(ref.authors);
  const candidateAuthors = normalizeAuthorSet(candidate.book.authors);
  for (const author of refAuthors) {
    if (candidateAuthors.has(author)) {
      score += 20;
    }
  }

  if (ownedBookIds.has(candidate.book.id)) {
    score += 15;
  }

  return score;
}

export async function resolveUserBookByReference(
  userId: string,
  ref: DonnaBookRef,
): Promise<ResolveBookResult> {
  if (ref.bookId) {
    const entry = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId: ref.bookId } },
      select: USER_BOOK_SELECT,
    });

    if (!entry) {
      return { matchStatus: "none", matchedBook: null, suggestions: [] };
    }

    const stateMap = await getDonnaStateMap(userId, [entry.bookId]);
    return {
      matchStatus: "exact",
      matchedBook: normalizeEntry(entry, stateMap.get(entry.bookId)),
      suggestions: [],
    };
  }

  if (ref.isbn10 || ref.isbn13) {
    const entry = await prisma.userBook.findFirst({
      where: {
        userId,
        book: {
          OR: [
            ...(ref.isbn10 ? [{ isbn10: ref.isbn10 }] : []),
            ...(ref.isbn13 ? [{ isbn13: ref.isbn13 }] : []),
          ],
        },
      },
      select: USER_BOOK_SELECT,
    });

    if (!entry) {
      return { matchStatus: "none", matchedBook: null, suggestions: [] };
    }

    const stateMap = await getDonnaStateMap(userId, [entry.bookId]);
    return {
      matchStatus: "exact",
      matchedBook: normalizeEntry(entry, stateMap.get(entry.bookId)),
      suggestions: [],
    };
  }

  if (!ref.title) {
    return { matchStatus: "none", matchedBook: null, suggestions: [] };
  }

  const candidates = await prisma.userBook.findMany({
    where: {
      userId,
      book: {
        title: {
          contains: ref.title,
          mode: "insensitive",
        },
      },
    },
    select: USER_BOOK_SELECT,
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  if (candidates.length === 0) {
    return { matchStatus: "none", matchedBook: null, suggestions: [] };
  }

  const stateMap = await getDonnaStateMap(userId, candidates.map((candidate) => candidate.bookId));
  const ownedIds = new Set(candidates.map((candidate) => candidate.bookId));
  const scored = candidates
    .map((candidate) => ({ candidate, score: rankTitleCandidate(candidate, ref, ownedIds) }))
    .sort((left, right) => right.score - left.score);

  if (scored[0] && scored[0].score >= 50 && (!scored[1] || scored[0].score - scored[1].score >= 20)) {
    return {
      matchStatus: scored[0].score >= 70 ? "exact" : "strong",
      matchedBook: normalizeEntry(scored[0].candidate, stateMap.get(scored[0].candidate.bookId)),
      suggestions: scored.slice(1, 4).map((item) => normalizeEntry(item.candidate, stateMap.get(item.candidate.bookId))),
    };
  }

  return {
    matchStatus: "ambiguous",
    matchedBook: null,
    suggestions: scored.slice(0, 5).map((item) => normalizeEntry(item.candidate, stateMap.get(item.candidate.bookId))),
  };
}

export async function resolveOrCreateBook(
  userId: string,
  ref: DonnaBookRef,
  payload: ReadingEventRequest["payload"],
): Promise<{ bookId: string; warnings: string[]; resolve: ResolveBookResult }> {
  const warnings: string[] = [];
  const resolve = await resolveUserBookByReference(userId, ref);

  if (resolve.matchStatus === "exact" || resolve.matchStatus === "strong") {
    return { bookId: resolve.matchedBook!.book.id, warnings, resolve };
  }

  if (resolve.matchStatus === "ambiguous") {
    return { bookId: "", warnings, resolve };
  }

  const title = payload.title ?? ref.title;
  const authors = payload.authors ?? ref.authors;
  if (!title || !authors || authors.length === 0) {
    return {
      bookId: "",
      warnings: ["Book could not be resolved and payload is insufficient to create it"],
      resolve,
    };
  }

  const createdBook = await prisma.book.create({
    data: {
      title,
      subtitle: payload.subtitle ?? null,
      authors,
      description: payload.description ?? null,
      coverUrl: payload.coverUrl ?? null,
      publisher: payload.publisher ?? null,
      publishedDate: payload.publishedDate ?? null,
      pageCount: payload.pageCount ?? null,
      isbn10: payload.isbn10 ?? ref.isbn10 ?? null,
      isbn13: payload.isbn13 ?? ref.isbn13 ?? null,
      genres: payload.genres ?? [],
    },
  });

  warnings.push("Created a new Book record because the reference did not resolve to an existing title");
  return { bookId: createdBook.id, warnings, resolve };
}

export async function resolveDonnaBook(ref: DonnaBookRef): Promise<ResolveBookResult> {
  const user = await getDonnaUserContext();
  return resolveUserBookByReference(user.userId, ref);
}
