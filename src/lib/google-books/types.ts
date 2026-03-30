export type { NormalizedBook } from "../book-providers/types";

export interface GoogleBooksIndustryIdentifier {
  type: string;
  identifier: string;
}

export interface GoogleBooksImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
}

export interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
  imageLinks?: GoogleBooksImageLinks;
  publisher?: string;
  pageCount?: number;
  categories?: string[];
  subtitle?: string;
}

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: GoogleBooksVolumeInfo;
}

export interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleBooksVolume[];
}
