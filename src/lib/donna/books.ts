import "server-only";

import { Prisma, type DonnaSemanticState as PrismaDonnaSemanticState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import { getViewableUserIds } from "@/lib/privacy/can-view-user-books";
import {
  isMissingDonnaStateSchemaError,
  isMissingListsSchemaError,
  isMissingSocialSchemaError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";
import type { DonnaBookRef, DonnaSemanticState, ReadingEventRequest } from "./contracts";
import { getDonnaUserContext } from "./user";

type SelectedUserBook = Prisma.UserBookGetPayload<{ select: typeof USER_BOOK_SELECT }>;

type NormalizedBook = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
};

type NormalizedLibraryEntry = {
  book: NormalizedBook;
  status: SelectedUserBook["status"];
  semanticState: DonnaSemanticState;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

type ResolveMatchStatus = "exact" | "strong" | "ambiguous" | "none";

type ResolveBookResult = {
  matchStatus: ResolveMatchStatus;
  matchedBook: NormalizedLibraryEntry | null;
  suggestions: NormalizedLibraryEntry[];
};

const SEMANTIC_TO_STATUS: Record<DonnaSemanticState, "WISHLIST" | "TO_READ" | "READING" | "REREADING" | "READ" | "ON_HOLD"> = {
  wishlist: "WISHLIST",
  to_read: "TO_READ",
  reading: "READING",
  rereading: "REREADING",
  read: "READ",
  paused: "ON_HOLD",
  abandoned: "ON_HOLD",
};

function normalizeBook(book: SelectedUserBook["book"]): NormalizedBook {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle ?? null,
    authors: book.authors,
    description: book.description ?? null,
    coverUrl: book.coverUrl ?? null,
    publisher: book.publisher ?? null,
    publishedDate: book.publishedDate ?? null,
    pageCount: book.pageCount ?? null,
    isbn10: book.isbn10 ?? null,
    isbn13: book.isbn13 ?? null,
    genres: book.genres,
  };
}

function getSemanticState(
  status: SelectedUserBook["status"],
  overrideState?: DonnaSemanticState | null,
): DonnaSemanticState {
  if (overrideState) {
    return overrideState;
  }

  switch (status) {
    case "WISHLIST":
      return "wishlist";
    case "TO_READ":
      return "to_read";
    case "READING":
      return "reading";
    case "REREADING":
      return "rereading";
    case "READ":
      return "read";
    case "ON_HOLD":
      return "paused";
    default:
      return "to_read";
  }
}

function normalizeEntry(
  entry: SelectedUserBook,
  semanticState?: DonnaSemanticState | null,
): NormalizedLibraryEntry {
  return {
    book: normalizeBook(entry.book),
    status: entry.status,
    semanticState: getSemanticState(entry.status, semanticState),
    rating: entry.rating ?? null,
    notes: entry.notes ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    finishedAt: null,
  };
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeAuthorSet(value: string[] | undefined): Set<string> {
  return new Set((value ?? []).map((author) => normalizeTitle(author)));
}

function getEventTimestamp(payload: ReadingEventRequest["payload"]): Date {
  if (!payload.occurredAt) {
    return new Date();
  }

  const parsed = new Date(payload.occurredAt);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

async function getDonnaStateMap(
  userId: string,
  bookIds: string[],
): Promise<Map<string, DonnaSemanticState>> {
  if (bookIds.length === 0) {
    return new Map();
  }

  try {
    const rows = await prisma.donnaBookState.findMany({
      where: { userId, bookId: { in: bookIds } },
      select: { bookId: true, semanticState: true },
    });

    return new Map(rows.map((row) => [
      row.bookId,
      row.semanticState.toLowerCase() as DonnaSemanticState,
    ]));
  } catch (error) {
    if (isMissingDonnaStateSchemaError(error)) {
      return new Map();
    }
    throw error;
  }
}

async function getLibraryEntriesForUser(userId: string): Promise<NormalizedLibraryEntry[]> {
  const rows = await prisma.userBook.findMany({
    where: { userId },
    select: USER_BOOK_SELECT,
    orderBy: { updatedAt: "desc" },
  });
  const stateMap = await getDonnaStateMap(userId, rows.map((row) => row.bookId));
  return rows.map((row) => normalizeEntry(row, stateMap.get(row.bookId)));
}

function computeWeeklyStreak(dates: Date[]): { current: number; unit: "weeks" } {
  if (dates.length === 0) {
    return { current: 0, unit: "weeks" };
  }

  const weeks = new Set<string>();
  for (const date of dates) {
    const copy = new Date(date);
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    weeks.add(`${copy.getUTCFullYear()}-${String(week).padStart(2, "0")}`);
  }

  let current = 0;
  const cursor = new Date();
  while (true) {
    const day = cursor.getUTCDay() || 7;
    cursor.setUTCDate(cursor.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((cursor.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const key = `${cursor.getUTCFullYear()}-${String(week).padStart(2, "0")}`;

    if (!weeks.has(key)) {
      break;
    }
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  return { current, unit: "weeks" };
}

function rankTitleCandidate(
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

async function resolveUserBookByReference(
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

async function resolveOrCreateBook(
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

async function upsertDonnaState(
  userId: string,
  bookId: string,
  semanticState: DonnaSemanticState,
  input: ReadingEventRequest,
): Promise<void> {
  try {
    await prisma.donnaBookState.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        semanticState: semanticState.toUpperCase() as PrismaDonnaSemanticState,
        lastEventType: input.event,
        lastEventAt: getEventTimestamp(input.payload),
        source: `${input.source.channel}:${input.source.actor}`,
        metadata: input.payload,
      },
      update: {
        semanticState: semanticState.toUpperCase() as PrismaDonnaSemanticState,
        lastEventType: input.event,
        lastEventAt: getEventTimestamp(input.payload),
        source: `${input.source.channel}:${input.source.actor}`,
        metadata: input.payload,
      },
    });
  } catch (error) {
    if (!isMissingDonnaStateSchemaError(error)) {
      throw error;
    }
  }
}

function nextSemanticState(
  event: ReadingEventRequest["event"],
  currentStatus?: SelectedUserBook["status"],
): DonnaSemanticState | null {
  switch (event) {
    case "wishlisted":
      return "wishlist";
    case "started":
      return currentStatus === "READ" ? "rereading" : "reading";
    case "restarted":
      return "rereading";
    case "finished":
      return "read";
    case "paused":
      return "paused";
    case "abandoned":
      return "abandoned";
    case "rated":
    case "noted":
      return null;
    default:
      return null;
  }
}

export async function getDonnaStatus() {
  const user = await getDonnaUserContext();
  const libraryCount = await prisma.userBook.count({ where: { userId: user.userId } }).catch(() => 0);

  return {
    ok: true,
    owner: user,
    contractVersion: "v1",
    libraryCount,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDonnaSummary() {
  const user = await getDonnaUserContext();
  const entries = await getLibraryEntriesForUser(user.userId).catch((error) => {
    if (isMissingUserBookSchemaError(error)) {
      return [];
    }
    throw error;
  });

  let activeLists: Array<{ id: string; name: string; description: string | null; itemCount: number }> = [];
  try {
    activeLists = (await prisma.bookList.findMany({
      where: { userId: user.userId },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })).map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description ?? null,
      itemCount: list._count.items,
    }));
  } catch (error) {
    if (!isMissingListsSchemaError(error)) {
      throw error;
    }
  }

  const rated = entries.filter((entry) => entry.rating != null).map((entry) => entry.rating as number);
  const readDates = entries
    .filter((entry) => entry.semanticState === "read")
    .map((entry) => new Date(entry.finishedAt ?? entry.updatedAt));

  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  for (const entry of entries.filter((item) =>
    item.semanticState === "read"
    || item.semanticState === "reading"
    || item.semanticState === "rereading"
  )) {
    for (const genre of entry.book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    for (const author of entry.book.authors) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
  }

  const byUpdatedAt = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return {
    owner: user,
    currentlyReading: byUpdatedAt.filter((entry) => entry.semanticState === "reading" || entry.semanticState === "rereading").slice(0, 5),
    recentlyFinished: byUpdatedAt.filter((entry) => entry.semanticState === "read").slice(0, 5),
    wishlistHighlights: byUpdatedAt.filter((entry) => entry.semanticState === "wishlist" || entry.semanticState === "to_read").slice(0, 5),
    topGenres: [...genreCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([genre, count]) => ({ genre, count })),
    topAuthors: [...authorCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([author, count]) => ({ author, count })),
    readingStreak: computeWeeklyStreak(readDates),
    averageRating: rated.length === 0 ? null : Math.round((rated.reduce((sum, value) => sum + value, 0) / rated.length) * 100) / 100,
    abandonedCount: entries.filter((entry) => entry.semanticState === "abandoned").length,
    activeLists,
    profileUpdatedAt: byUpdatedAt[0]?.updatedAt ?? new Date().toISOString(),
  };
}

export async function getDonnaLibrarySnapshot() {
  const user = await getDonnaUserContext();
  const items = await getLibraryEntriesForUser(user.userId);
  return {
    owner: user,
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
  };
}

export async function resolveDonnaBook(ref: DonnaBookRef): Promise<ResolveBookResult> {
  const user = await getDonnaUserContext();
  return resolveUserBookByReference(user.userId, ref);
}

export async function getDonnaRecommendations() {
  const { userId } = await getDonnaUserContext();
  const userBookIds = await prisma.userBook.findMany({
    where: { userId },
    select: { bookId: true },
  });
  const myBookIds = new Set(userBookIds.map((row) => row.bookId));

  if (myBookIds.size === 0) {
    return { recommendations: [] };
  }

  const sharedBookUsers = await prisma.userBook.groupBy({
    by: ["userId"],
    where: {
      bookId: { in: [...myBookIds] },
      userId: { not: userId },
    },
    _count: true,
    having: { userId: { _count: { gte: 1 } } },
  });

  let followingIds: string[] = [];
  let groupMemberIds: string[] = [];
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    followingIds = following.map((item) => item.followingId);

    const myGroups = await prisma.groupMember.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { groupId: true },
    });

    if (myGroups.length > 0) {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: myGroups.map((group) => group.groupId) },
          userId: { not: userId },
          status: "ACCEPTED",
        },
        select: { userId: true },
      });
      groupMemberIds = groupMembers.map((row) => row.userId);
    }
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) {
      throw error;
    }
  }

  const similarReaderIds = new Set([
    ...sharedBookUsers.map((item) => item.userId),
    ...followingIds,
    ...groupMemberIds,
  ]);
  const allowedReaderIds = [...await getViewableUserIds(userId, [...similarReaderIds])];

  if (allowedReaderIds.length === 0) {
    return { recommendations: [] };
  }

  const candidateBooks = await prisma.userBook.findMany({
    where: {
      userId: { in: allowedReaderIds },
      status: { in: ["READ", "READING"] },
      bookId: { notIn: [...myBookIds] },
    },
    select: {
      bookId: true,
      book: {
        select: {
          id: true,
          title: true,
          subtitle: true,
          authors: true,
          description: true,
          coverUrl: true,
          publisher: true,
          publishedDate: true,
          pageCount: true,
          isbn10: true,
          isbn13: true,
          genres: true,
        },
      },
    },
  });

  const counts = new Map<string, { book: NormalizedBook; readerCount: number }>();
  for (const candidate of candidateBooks) {
    const existing = counts.get(candidate.bookId);
    if (existing) {
      existing.readerCount += 1;
    } else {
      counts.set(candidate.bookId, {
        book: {
          id: candidate.book.id,
          title: candidate.book.title,
          subtitle: candidate.book.subtitle ?? null,
          authors: candidate.book.authors,
          description: candidate.book.description ?? null,
          coverUrl: candidate.book.coverUrl ?? null,
          publisher: candidate.book.publisher ?? null,
          publishedDate: candidate.book.publishedDate ?? null,
          pageCount: candidate.book.pageCount ?? null,
          isbn10: candidate.book.isbn10 ?? null,
          isbn13: candidate.book.isbn13 ?? null,
          genres: candidate.book.genres,
        },
        readerCount: 1,
      });
    }
  }

  return {
    recommendations: [...counts.values()].sort((left, right) => right.readerCount - left.readerCount).slice(0, 20),
  };
}

export async function getDonnaLists() {
  const { userId } = await getDonnaUserContext();

  try {
    const lists = await prisma.bookList.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return {
      total: lists.length,
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description ?? null,
        itemCount: list._count.items,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    if (isMissingListsSchemaError(error)) {
      return { total: 0, lists: [] };
    }
    throw error;
  }
}

export async function applyDonnaReadingEvent(input: ReadingEventRequest) {
  const user = await getDonnaUserContext();
  const warnings: string[] = [];
  const resolution = await resolveOrCreateBook(user.userId, input.bookRef, input.payload);

  warnings.push(...resolution.warnings);
  if (!resolution.bookId) {
    return {
      applied: false,
      resolvedBook: null,
      resultingState: null,
      warnings,
      matchStatus: resolution.resolve.matchStatus,
      suggestions: resolution.resolve.suggestions,
    };
  }

  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: user.userId, bookId: resolution.bookId } },
    select: USER_BOOK_SELECT,
  });

  const semanticState = nextSemanticState(input.event, existing?.status) ?? getSemanticState(existing?.status ?? "WISHLIST");
  const nextStatus = (nextSemanticState(input.event, existing?.status)
    ? SEMANTIC_TO_STATUS[semanticState]
    : existing?.status ?? "WISHLIST");
  const eventAt = getEventTimestamp(input.payload);
  const nextNotes = input.payload.notes ?? existing?.notes ?? null;
  const nextRating = input.payload.rating ?? existing?.rating ?? null;

  const saved = existing
    ? await prisma.userBook.update({
        where: { userId_bookId: { userId: user.userId, bookId: resolution.bookId } },
        data: {
          status: nextStatus,
          notes: nextNotes,
          rating: nextRating,
          finishedAt: nextStatus === "READ" ? eventAt : null,
        },
        select: USER_BOOK_SELECT,
      })
    : await prisma.userBook.create({
        data: {
          userId: user.userId,
          bookId: resolution.bookId,
          status: nextStatus,
          notes: nextNotes,
          rating: nextRating,
          finishedAt: nextStatus === "READ" ? eventAt : null,
        },
        select: USER_BOOK_SELECT,
      });

  await upsertDonnaState(user.userId, resolution.bookId, semanticState, input);

  return {
    applied: true,
    resolvedBook: normalizeBook(saved.book),
    resultingState: {
      status: saved.status,
      semanticState,
      rating: saved.rating ?? null,
      notes: saved.notes ?? null,
      updatedAt: saved.updatedAt.toISOString(),
      finishedAt: nextStatus === "READ" ? eventAt.toISOString() : null,
    },
    warnings,
    matchStatus: resolution.resolve.matchStatus,
    suggestions: [],
  };
}
