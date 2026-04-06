import { z } from "zod";

export const donnaSemanticStateSchema = z.enum([
  "wishlist",
  "to_read",
  "reading",
  "rereading",
  "read",
  "paused",
  "abandoned",
]);

export const donnaBookRefSchema = z.object({
  bookId: z.string().min(1).optional(),
  isbn10: z.string().min(1).optional(),
  isbn13: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  authors: z.array(z.string().min(1)).optional(),
}).refine(
  (value) => Boolean(value.bookId || value.isbn10 || value.isbn13 || value.title),
  { message: "bookRef must include bookId, isbn10, isbn13, or title" },
);

export const readingEventSchema = z.enum([
  "wishlisted",
  "started",
  "finished",
  "paused",
  "abandoned",
  "rated",
  "noted",
  "restarted",
]);

export const readingEventPayloadSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().min(1).optional(),
  authors: z.array(z.string().min(1)).optional(),
  description: z.string().min(1).optional(),
  coverUrl: z.string().url().optional(),
  publisher: z.string().min(1).optional(),
  publishedDate: z.string().min(1).optional(),
  pageCount: z.number().int().positive().optional(),
  isbn10: z.string().min(1).optional(),
  isbn13: z.string().min(1).optional(),
  genres: z.array(z.string().min(1)).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
}).default({});

export const readingEventRequestSchema = z.object({
  event: readingEventSchema,
  bookRef: donnaBookRefSchema,
  payload: readingEventPayloadSchema,
  source: z.object({
    channel: z.string().min(1).default("internal"),
    actor: z.string().min(1).default("Donna"),
  }).default({
    channel: "internal",
    actor: "Donna",
  }),
});

export const resolveBookRequestSchema = z.object({
  bookRef: donnaBookRefSchema,
});

export type DonnaSemanticState = z.infer<typeof donnaSemanticStateSchema>;
export type DonnaBookRef = z.infer<typeof donnaBookRefSchema>;
export type ReadingEventRequest = z.infer<typeof readingEventRequestSchema>;
