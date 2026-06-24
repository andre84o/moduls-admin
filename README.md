# moduls-admin

Reusable multi-tenant SaaS admin base (Next.js App Router + Supabase + Prisma).
One shared database holds many businesses; every business-owned row is scoped by
`businessId`. Optional features (RENTAL, BOOKING, CRM, …) are modules enabled
per business. See `CLAUDE.md` / `AGENTS.md` for the full architecture rules.

## Getting started

```bash
npm install
cp .env.example .env      # fill in values (see below)
npx prisma generate
npx prisma migrate deploy # or: npx prisma db push
npm run dev               # http://localhost:3000
```

**Demo mode:** if `DATABASE_URL` is not configured the app runs in demo mode —
fully browsable with seeded data and a synthetic `SUPER_ADMIN`, no DB needed.

## Environment variables

Copy `.env.example` → `.env`. Never commit real secrets.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres (Prisma, pooled). Unset → demo mode. |
| `DIRECT_URL` | Postgres direct connection (migrations). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key — Auth (browser-safe). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Trusted Storage ops. **Never expose.** |
| `SUPABASE_PUBLIC_BUCKET` | Public bucket (website images/logos). Default `media-public`. |
| `SUPABASE_PRIVATE_BUCKET` | Private bucket (documents/customer files). Default `media-private`. |
| `RESEND_API_KEY` | Email via Resend. Unset → sends skipped (logged). |
| `EMAIL_FROM` | From address for outbound email. |
| `ADMIN_EMAIL` | Fallback admin recipient when a business has no email. |

## Tenant isolation (rule of thumb)

- `businessId` is always resolved **server-side** from the session via
  `requireBusinessAccess()` — never trusted from the client.
- Reads/updates/deletes of business data are always scoped by `businessId`
  (`updateMany`/`deleteMany` with `{ id, businessId }`, never `id` alone).
- Module-owned routes/actions add `requireModule(type)` on top; platform tools
  use `requireSuperAdmin()`. Cross-business access is `SUPER_ADMIN`-only.

## Media upload flow

Central, reusable media library. Images are compressed server-side; documents
stored as-is. Every file is scoped to the current business and gets a `Media`
DB row. Two Supabase Storage buckets back it:

- **PUBLIC** — website images/logos, served via a permanent URL.
- **PRIVATE** — documents + customer files, served via short-lived signed URLs.

Storage path: `businesses/{businessId}/images|documents/{filename}`.

**Components** (`components/`)
- `MediaUpload/` — client dropzone. Auto-submits on file pick. Props:
  `ownerType`, `ownerId`, `propertyId`, `folder`, `accept`, `multiple`,
  `revalidate`, `label`. Example:
  ```tsx
  <MediaUpload propertyId={p.id} accept="image/*" />
  <MediaUpload folder="logos" ownerType="Business" ownerId={businessId} />
  ```
- `MediaLibrary/` — client grid/list of media with delete.
- `app/admin/_components/sections/media.tsx` — admin section combining both
  (kept for reuse; not mounted in the admin nav).

**Server actions** (`lib/media-actions.ts`, form-facing)
- `uploadMedia(formData)` — used by `MediaUpload`. Property-owned attach
  (`propertyId` / `ownerType="Property"`) requires the `RENTAL` module; general
  library uploads are core.
- `deleteMediaItem(id, revalidate)` — used by `MediaLibrary`.

**Service** (`lib/media.ts`, server-only — the access-checked core)
- `createMediaRecord({ file, folder, alt, ownerType, ownerId, propertyId })` —
  resolves `businessId`, verifies the attach target belongs to the business
  (whitelist: `Property`, `Customer`, `Project`, `Business`), compresses + stores,
  writes the `Media` row + audit log.
- `listMedia(filter)` / `getMediaFor(ownerType, ownerId)` — list scoped media
  (private files returned with signed URLs).
- `deleteMediaRecord(id)` — delete file + row, scoped by `businessId`.
- `exportBusinessMedia()` / `purgeBusinessMedia()` — `OWNER` / `SUPER_ADMIN`.

**Storage** (`lib/storage.ts`) — Supabase Storage via service-role client:
upload (sharp → WebP), signed URLs, delete, per-business listing/erasure.

**Flow:** `MediaUpload` → `uploadMedia` (action) → `createMediaRecord` (tenant +
owner checks) → `uploadBusinessFile` (compress + store) → `Media` row + audit.
Display via `listMedia` (signed URLs for private); delete via `deleteMediaItem`.

> Upload size limit is set in `next.config.ts` (`serverActions.bodySizeLimit`).

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the build
npx tsc --noEmit # type-check
```
