import type { NormalizedBook } from "./types";

const RESULT_LIMIT = 40;
export const PROVIDER_LIMIT = 40;

function sanitizeQuery(rawQuery: string): string {
  return String(rawQuery || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeText(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && token !== "by");
}

function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false;
  }

  const checksum = isbn.split("").reduce((total, character, index) => {
    const value = character === "X" ? 10 : Number(character);
    return total + value * (10 - index);
  }, 0);

  return checksum % 11 === 0;
}

function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }

  const checksum = isbn.split("").reduce((total, character, index) => {
    const weight = index % 2 === 0 ? 1 : 3;
    return total + Number(character) * weight;
  }, 0);

  return checksum % 10 === 0;
}

function detectIsbn(query: string): string | null {
  const compact = query.replace(/[^0-9X]/gi, "").toUpperCase();

  if (compact.length === 10 && isValidIsbn10(compact)) {
    return compact;
  }

  if (compact.length === 13 && isValidIsbn13(compact)) {
    return compact;
  }

  return null;
}

function extractTitleAuthor(
  query: string
): { title: string; author: string } | null {
  const match = query.match(/^(.+?)\s+by\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const title = sanitizeQuery(match[1] ?? "");
  const author = sanitizeQuery(match[2] ?? "");

  if (title.length < 2 || author.length < 2) {
    return null;
  }

  return { title, author };
}

type IsbnAnalysis = {
  kind: "isbn";
  query: string;
  isbn: string;
  googleQuery: string;
  providerMaxResults: number;
  tokens: string[];
  normalizedQuery: string;
};

type TitleAuthorAnalysis = {
  kind: "title-author";
  query: string;
  title: string;
  author: string;
  googleQuery: string;
  providerMaxResults: number;
  tokens: string[];
  titleTokens: string[];
  authorTokens: string[];
  normalizedQuery: string;
  normalizedTitle: string;
  normalizedAuthor: string;
};

type TextAnalysis = {
  kind: "text";
  query: string;
  googleQuery: string;
  providerMaxResults: number;
  tokens: string[];
  normalizedQuery: string;
};

type QueryAnalysis = IsbnAnalysis | TitleAuthorAnalysis | TextAnalysis;

export function analyzeQuery(rawQuery: string): QueryAnalysis {
  const query = sanitizeQuery(rawQuery);
  const isbn = detectIsbn(query);

  if (isbn) {
    return {
      kind: "isbn",
      query,
      isbn,
      googleQuery: `isbn:${isbn}`,
      providerMaxResults: RESULT_LIMIT,
      tokens: [isbn],
      normalizedQuery: normalizeText(query),
    };
  }

  const titleAuthor = extractTitleAuthor(query);

  if (titleAuthor) {
    return {
      kind: "title-author",
      query,
      title: titleAuthor.title,
      author: titleAuthor.author,
      googleQuery: `intitle:"${titleAuthor.title}" inauthor:"${titleAuthor.author}"`,
      providerMaxResults: PROVIDER_LIMIT,
      tokens: tokenize(query),
      titleTokens: tokenize(titleAuthor.title),
      authorTokens: tokenize(titleAuthor.author),
      normalizedQuery: normalizeText(query),
      normalizedTitle: normalizeText(titleAuthor.title),
      normalizedAuthor: normalizeText(titleAuthor.author),
    };
  }

  return {
    kind: "text",
    query,
    googleQuery: query,
    providerMaxResults: PROVIDER_LIMIT,
    tokens: tokenize(query),
    normalizedQuery: normalizeText(query),
  };
}

function countTokenMatches(tokens: string[], text: string): number {
  return tokens.reduce(
    (count, token) => count + (text.includes(token) ? 1 : 0),
    0
  );
}

function scoreBook(book: NormalizedBook, analysis: QueryAnalysis): number {
  const title = normalizeText(book.title);
  const authors = normalizeText(book.authors.join(" "));
  const isbn = String(book.isbn ?? "")
    .replace(/[^0-9X]/gi, "")
    .toUpperCase();

  if (analysis.kind === "isbn") {
    return isbn === analysis.isbn ? 500 : -100;
  }

  let score = 0;
  const totalText = `${title} ${authors}`.trim();

  if (title === analysis.normalizedQuery) {
    score += 120;
  } else if (title.startsWith(analysis.normalizedQuery)) {
    score += 90;
  } else if (title.includes(analysis.normalizedQuery)) {
    score += 70;
  }

  // Author name as full phrase match — strong signal the query IS an author
  if (authors.includes(analysis.normalizedQuery)) {
    score += 80;
  }

  const titleMatches = countTokenMatches(analysis.tokens, title);
  const authorMatches = countTokenMatches(analysis.tokens, authors);
  const totalMatches = countTokenMatches(analysis.tokens, totalText);

  score += titleMatches * 18;
  score += authorMatches * 16;

  // If ALL query tokens match the author, this is very likely an author search
  if (analysis.tokens.length > 1 && authorMatches === analysis.tokens.length) {
    score += 60;
  }

  if (analysis.tokens.length > 1 && totalMatches === analysis.tokens.length) {
    score += 35;
  }

  if (analysis.kind === "title-author") {
    if (title === analysis.normalizedTitle) {
      score += 140;
    }

    if (title.includes(analysis.normalizedTitle)) {
      score += 80;
    }

    if (authors.includes(analysis.normalizedAuthor)) {
      score += 60;
    }

    if (
      analysis.titleTokens.length > 0 &&
      countTokenMatches(analysis.titleTokens, title) ===
        analysis.titleTokens.length
    ) {
      score += 30;
    }

    if (
      analysis.authorTokens.length > 0 &&
      countTokenMatches(analysis.authorTokens, authors) ===
        analysis.authorTokens.length
    ) {
      score += 25;
    }
  }

  if (score === 0) {
    score = -10;
  }

  return score;
}

export function rankSearchResults(
  results: NormalizedBook[],
  analysis: QueryAnalysis
): NormalizedBook[] {
  const ranked = results
    .map((book, index) => ({ book, index, score: scoreBook(book, analysis) }))
    .sort(
      (left, right) =>
        right.score - left.score || left.index - right.index
    );

  if (analysis.kind === "isbn") {
    return ranked
      .filter((entry) => entry.score > 0)
      .map((entry) => entry.book)
      .slice(0, RESULT_LIMIT);
  }

  const positiveMatches = ranked
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.book);

  const selected =
    positiveMatches.length > 0
      ? positiveMatches
      : ranked.map((entry) => entry.book);

  return selected.slice(0, RESULT_LIMIT);
}
