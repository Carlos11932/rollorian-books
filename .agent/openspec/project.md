---
type: project-init
project: rollorian-books
created: 2026-03-24
status: active
---

# Project: rollorian-books

## Overview
Personal book library app — search, save, and track reading status of books.

## Stack
- Next.js 16.2 + App Router
- React 19 + React Compiler
- TypeScript 5 (strict)
- Tailwind CSS 4
- Prisma 7.5 + PostgreSQL (Neon serverless)
- Zod for validation

## Repository
https://github.com/Carlos11932/rollorian-books

## Deployment
Vercel (team: carlos11932s-projects, project: rollorian-books)

## Architecture Principles
- Server Components by default — "use client" only for interactivity
- Features organized by domain: `src/features/{books,shared}/`
- API service layer: `src/lib/api/books.ts` — no fetch calls in components
- Single source of truth for types: `src/lib/types/book.ts`
- Zod schemas for all external input validation

## Testing
- Unit: Vitest 140 tests in `src/**/__tests__/`
- E2E: Playwright 15 tests in `e2e/`
- CI: GitHub Actions (lint + type-check + unit + e2e)

## Known Decisions
- Authentication: intentionally deferred — will be added when user system is designed
- E2E uses production Neon DB with seed data (no separate test DB yet)
- React Compiler enabled — no manual useMemo/useCallback needed

## Active Work
Branch: improve/architecture-quality — architecture improvements, tests, CI setup
