import type {
  GoogleBooksVolume,
  GoogleBooksIndustryIdentifier,
  GoogleBooksImageLinks,
  NormalizedBook,
} from "./types";

function buildCoverUrl(imageLinks: GoogleBooksImageLinks | undefined): string | null {
  if (!imageLinks) {
    return null;
  }

  const rawUrl = imageLinks.thumbnail ?? imageLinks.smallThumbnail ?? null;

  if (!rawUrl) {
    return null;
  }

  return rawUrl.replace("http://", "https://");
}

function selectIndustryIdentifier(
  identifiers: GoogleBooksIndustryIdentifier[] | undefined,
  preferredType: string
): string | null {
  if (!Array.isArray(identifiers)) {
    return null;
  }

  const match = identifiers.find(
    (identifier) => identifier.type === preferredType && identifier.identifier
  );

  return match?.identifier ?? null;
}

function extractPublishedYear(publishedDate: string | undefined): number | null {
  if (typeof publishedDate !== "string") {
    return null;
  }

  const match = publishedDate.match(/^(\d{4})/);
  return match?.[1] != null ? Number(match[1]) : null;
}

function normalizeBook(item: GoogleBooksVolume): NormalizedBook {
  const volumeInfo = item.volumeInfo ?? {};
  const isbn13 = selectIndustryIdentifier(
    volumeInfo.industryIdentifiers,
    "ISBN_13"
  );
  const isbn10 = selectIndustryIdentifier(
    volumeInfo.industryIdentifiers,
    "ISBN_10"
  );

  const externalId =
    item.id ??
    isbn13 ??
    `fallback-${volumeInfo.title ?? "unknown"}`;

  return {
    externalSource: "google_books",
    externalId,
    title: volumeInfo.title ?? "Untitled",
    authors: Array.isArray(volumeInfo.authors)
      ? volumeInfo.authors.filter((a): a is string => typeof a === "string" && a.length > 0)
      : [],
    publishedYear: extractPublishedYear(volumeInfo.publishedDate),
    isbn: isbn13 ?? isbn10,
    coverUrl: buildCoverUrl(volumeInfo.imageLinks),
  };
}

export function normalizeSearchResults(docs: GoogleBooksVolume[]): NormalizedBook[] {
  return docs.map(normalizeBook);
}

export function normalizeSingleBook(volume: GoogleBooksVolume): NormalizedBook {
  return normalizeBook(volume);
}
