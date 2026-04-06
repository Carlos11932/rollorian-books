# Donna Internal API

These contracts exist for Donna on the Pi5.

## Auth

- Header: `x-api-key`
- Environment: `INTERNAL_API_KEY`
- Donna user resolution:
  - `DONNA_USER_EMAIL`
  - fallback: `SUPERADMIN_EMAIL`

## Endpoints

- `GET /api/internal/donna/status`
- `GET /api/internal/donna/context/summary`
- `GET /api/internal/donna/context/library-snapshot`
- `GET /api/internal/donna/context/recommendations`
- `GET /api/internal/donna/context/lists`
- `POST /api/internal/donna/context/resolve-book`
- `POST /api/internal/donna/actions/reading-event`

## Notes

- Donna consumes domain DTOs, not raw Prisma models
- `abandoned` is represented semantically through `DonnaBookState`
- ambiguous matches must not mutate data without clarification
