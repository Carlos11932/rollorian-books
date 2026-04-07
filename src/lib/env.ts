import "server-only";

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared transforms
// ---------------------------------------------------------------------------
// Normalizes empty strings to undefined BEFORE further validation.
// This prevents `VAR=""` in .env from being treated as a present value.
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (!v || v === "" ? undefined : v));

// ---------------------------------------------------------------------------
// Auth / NextAuth
// ---------------------------------------------------------------------------
const authSchema = z.object({
  AUTH_SECRET: z.string().min(1, { error: "AUTH_SECRET is required" }),
  AUTH_GOOGLE_ID: z.string().min(1, { error: "AUTH_GOOGLE_ID is required" }),
  AUTH_GOOGLE_SECRET: z.string().min(1, { error: "AUTH_GOOGLE_SECRET is required" }),
  // When present, validate as URL. Vercel may inject this automatically.
  NEXTAUTH_URL: z
    .string()
    .optional()
    .transform((v) => (!v || v === "" ? undefined : v))
    .pipe(z.url({ error: "NEXTAUTH_URL must be a valid URL" }).optional()),
  SUPERADMIN_EMAIL: optionalNonEmpty,
  PREVIEW_ALLOWED_EMAILS: optionalNonEmpty,
  // VERCEL_ENV is injected by Vercel infrastructure — "production" | "preview" | "development"
  VERCEL_ENV: z.string().optional(),
  // VERCEL_URL is injected by Vercel at runtime (no https:// prefix)
  VERCEL_URL: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required" }),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  DIRECT_URL: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Database Safety
// ---------------------------------------------------------------------------
const databaseSafetySchema = z.object({
  ROLLORIAN_DB_CONTEXT: optionalNonEmpty,
  ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS: optionalNonEmpty,
});

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------
const emailSchema = z.object({
  RESEND_API_KEY: optionalNonEmpty,
});

// ---------------------------------------------------------------------------
// Google Books
// ---------------------------------------------------------------------------
const googleBooksSchema = z.object({
  GOOGLE_BOOKS_API_KEY: optionalNonEmpty,
});

// ---------------------------------------------------------------------------
// Donna (optional feature)
// ---------------------------------------------------------------------------
const donnaSchema = z.object({
  // When present, must be a valid email address.
  DONNA_USER_EMAIL: z
    .string()
    .optional()
    .transform((v) => (!v || v === "" ? undefined : v))
    .pipe(z.email({ error: "DONNA_USER_EMAIL must be a valid email" }).optional()),
  // When present, must be at least 32 characters. Empty string is treated as absent.
  INTERNAL_API_KEY: z
    .string()
    .optional()
    .transform((v) => (!v || v === "" ? undefined : v))
    .pipe(
      z
        .string()
        .min(32, { error: "INTERNAL_API_KEY must be at least 32 characters" })
        .optional()
    ),
});

// ---------------------------------------------------------------------------
// Runtime / Testing
// ---------------------------------------------------------------------------
const runtimeSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  E2E_TEST_MODE: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Merged server schema
// ---------------------------------------------------------------------------
const serverEnvSchema = authSchema
  .merge(databaseSchema)
  .merge(databaseSafetySchema)
  .merge(emailSchema)
  .merge(googleBooksSchema)
  .merge(donnaSchema)
  .merge(runtimeSchema);

// Validate at import time — fail fast on missing required vars
export const env = serverEnvSchema.parse(process.env);
