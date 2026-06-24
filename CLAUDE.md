@AGENTS.md

hämta componenter från https://ui.shadcn.com

## Project base / SaaS template rule

This project should be treated as a reusable SaaS base for future small-business projects, not as a one-off client project.

Core functionality should stay generic and reusable:

* Auth
* Business
* BusinessMember
* Users
* Roles
* Admin shell
* Media library
* Audit logs
* Settings
* Storage setup
* Tenant isolation

Do not hardcode client-specific names, routes, business logic, demo data, or UI text into the core system.

All business-owned data must always be scoped by `businessId`.

Never read, update, delete, list, or attach business-owned data by `id` alone.

Always resolve `businessId` on the server from the logged-in user and their `BusinessMember` access.

Optional features such as booking, CRM, rentals, services, staff, invoices, and website pages should be treated as modules that can be enabled per business.

Before adding a new feature, decide whether it belongs to:

1. Core SaaS foundation
2. Optional module
3. Client-specific customization

Do not mix these layers.

# Shared Supabase + Prisma Architecture Rules

This project uses the shared Supabase database for multiple small client projects.

The database is multi-tenant.

Claude must never design this project as a single-client database unless explicitly instructed.

Claude must never create separate tables per client.

Claude must never mix data between businesses, clients, or projects.

## Required core idea

One shared Supabase database can contain many businesses.

Each business can have different enabled modules, for example:

* CRM
* Booking
* Website admin
* Media library
* Staff management
* Rental system
* Custom admin tools

Even if different businesses use different features, all business-owned data must follow the same tenant isolation structure.

## Required tenant structure

Every business-owned table must include `businessId`.

Examples of business-owned tables:

* Customer
* Booking
* Service
* Media
* Project
* StaffProfile
* CrmNote
* Invoice
* Message
* UploadedFile
* Setting

These tables must always include:

* `id`
* `businessId`
* `createdAt`
* `updatedAt` where relevant

Never create tables like:

* `client_customers`
* `pizza_bookings`
* `stefanie_media`
* `anki_users`

Always create shared tables like:

* `Business`
* `User`
* `BusinessMember`
* `Project`
* `Customer`
* `Service`
* `Booking`
* `Media`
* `AuditLog`

## Required base models

Every admin/login project must start with these base models unless explicitly instructed otherwise:

* `Business`
* `User`
* `BusinessMember`
* `Project`
* `AuditLog`

If the project needs CRM, add:

* `Customer`
* `CrmNote`

If the project needs booking, add:

* `Service`
* `Booking`
* `Availability`
* `BlockedTime`

If the project needs uploads/images/files, add:

* `Media`

Do not add unnecessary models.

Do not create separate database structures for each client.

## Business model

`Business` represents the client/company.

Required fields:

* `id`
* `name`
* `slug`
* `status`
* `createdAt`
* `updatedAt`

Optional fields depending on project:

* `logoUrl`
* `website`
* `phone`
* `email`
* `address`
* `settings`

## User model

`User` represents a login user.

Use Supabase Auth for authentication.

The local `User` model must store the Supabase Auth user id as `supabaseId`.

Required fields:

* `id`
* `supabaseId`
* `email`
* `username`
* `firstName`
* `lastName`
* `createdAt`
* `updatedAt`

Do not store passwords in Prisma.

Passwords belong only to Supabase Auth.

## BusinessMember model

`BusinessMember` connects users to businesses.

A user can belong to multiple businesses.

A business can have multiple users.

Required fields:

* `id`
* `businessId`
* `userId`
* `role`
* `createdAt`

Use this for roles and access control.

Do not store only one global role on `User` for business access.

## Required roles

Use these roles:

* `SUPER_ADMIN`
* `OWNER`
* `ADMIN`
* `STAFF`

Meaning:

* `SUPER_ADMIN` can access all businesses and platform-level admin tools.
* `OWNER` owns one business.
* `ADMIN` manages one business.
* `STAFF` has limited access inside one business.

A role must be checked together with `businessId`.

A user being `ADMIN` for one business does not mean they are admin for another business.

## Project model

`Project` represents a client module or system inside a business.

Examples:

* CRM
* BOOKING
* WEBSITE
* RENTAL
* ECOMMERCE
* CUSTOM

Required fields:

* `id`
* `businessId`
* `name`
* `type`
* `status`
* `createdAt`
* `updatedAt`

A business can have multiple projects/modules.

Different businesses can have different modules enabled.

## Absolute tenant isolation rules

These rules are mandatory.

Every read, create, update, and delete operation for business-owned data must be scoped to `businessId`.

Never read business-owned data without `businessId`.

Never update business-owned data by `id` only.

Never delete business-owned data by `id` only.

Never trust `businessId` from the frontend.

The current `businessId` must be resolved on the server from:

1. The logged-in Supabase user.
2. The local `User` record.
3. The `BusinessMember` record.
4. The requested business/project access.

Bad:

```ts
await prisma.customer.findMany()
```

Good:

```ts
await prisma.customer.findMany({
  where: {
    businessId: currentBusinessId,
  },
})
```

Bad:

```ts
await prisma.booking.update({
  where: {
    id: bookingId,
  },
  data: {
    status: "CONFIRMED",
  },
})
```

Good:

```ts
await prisma.booking.updateMany({
  where: {
    id: bookingId,
    businessId: currentBusinessId,
  },
  data: {
    status: "CONFIRMED",
  },
})
```

Bad:

```ts
await prisma.media.delete({
  where: {
    id: mediaId,
  },
})
```

Good:

```ts
await prisma.media.deleteMany({
  where: {
    id: mediaId,
    businessId: currentBusinessId,
  },
})
```

If a query cannot safely include `businessId`, stop and explain why before implementing.

## Required backend access helper

All admin routes, server actions, and protected server components must use a shared access helper.

Create and use a helper similar to:

```ts
const access = await requireBusinessAccess({
  businessId,
  allowedRoles: ["OWNER", "ADMIN", "STAFF"],
})
```

The helper must:

* Verify Supabase session.
* Find the local `User`.
* Verify `BusinessMember`.
* Verify role access.
* Return the safe `businessId`.
* Reject unauthorized access.

Do not duplicate access logic in every file.

Do not rely on client-side checks for security.

## SUPER_ADMIN rules

`SUPER_ADMIN` access must be explicit.

Claude must not accidentally allow all admins to access all businesses.

Only `SUPER_ADMIN` may query across businesses.

Any cross-business query must include a clear comment explaining why it is platform-level access.

Example:

```ts
// Platform-level access. Only SUPER_ADMIN may view all businesses.
```

## Supabase and Prisma rules

Use Supabase for:

* Auth
* Postgres
* Storage

Use Prisma for:

* Server-side database queries
* Prisma schema
* migrations
* type-safe database access

Do not use Prisma in client components.

Do not expose Prisma directly to the browser.

Do not expose Supabase service role key to the browser.

Private admin data must be loaded server-side.

## Supabase Storage rules

All uploaded files must be stored in business-specific folders.

Use this path structure:

```txt
businesses/{businessId}/images/{filename}
businesses/{businessId}/documents/{filename}
businesses/{businessId}/uploads/{filename}
```

Never upload all business files into one shared flat folder.

Every uploaded file must have a `Media` database record with:

* `id`
* `businessId`
* `url`
* `path`
* `type`
* `alt`
* `createdAt`

Never show media from another `businessId`.

Never delete media by path only without verifying `businessId`.

## Public route rules

Public pages may only expose public and active data.

Public routes must never expose:

* internal notes
* private customer data
* staff-only information
* admin settings
* hidden bookings
* private media
* other businesses' data

If public data belongs to a business, the route must still scope by:

* `businessId`, or
* public `business.slug`, or
* public project slug connected to `businessId`

## Admin route rules

Admin routes must always be protected.

Every admin page must verify:

1. User is logged in.
2. Local user exists.
3. User belongs to the selected business.
4. User role allows the action.
5. Data is filtered by `businessId`.

Never use frontend redirects as the only protection.

Backend/server protection is required.

## Booking rules

If the project includes bookings:

* Prevent double booking server-side.
* Validate start and end time server-side.
* Store `businessId` on every booking.
* Store `customerId` when relevant.
* Store `serviceId` when relevant.
* Store `staffId` when relevant.
* Never trust available time slots from the frontend.

Booking conflicts must be checked in the backend before creating or updating a booking.

## CRM rules

If the project includes CRM:

Every customer must belong to one business.

Every note, tag, message, task, or activity must include `businessId`.

CRM data must never be shared across businesses.

Customer search must always be filtered by `businessId`.

## Audit log rules

Important admin actions should create an `AuditLog` record.

Examples:

* customer created
* booking changed
* media deleted
* user invited
* role changed
* business settings updated

`AuditLog` must include:

* `id`
* `businessId`
* `userId`
* `action`
* `entityType`
* `entityId`
* `metadata`
* `createdAt`

## Naming rules

Use generic names.

Good:

* business
* project
* customer
* service
* booking
* member
* staff
* media

Avoid narrow names unless the project specifically requires them.

Bad:

* salon
* hairdresser
* pizza
* therapist
* rentalOwner

## UI text rules

All UI text shown in the interface must be in English unless the project explicitly says otherwise.

This includes:

* buttons
* menus
* labels
* errors
* empty states
* dashboard text

Code comments can be in Swedish if useful.

## Required review before completion

Before marking work as complete, Claude must check:

* Every business-owned model has `businessId`.
* Every business-owned query is scoped by `businessId`.
* No update/delete uses `id` only.
* Auth is checked server-side.
* Role access is checked server-side.
* Supabase service role key is not exposed.
* Storage paths include `businessId`.
* Public routes expose only safe data.
* Admin routes are protected.
* Prisma schema is consistent.
* No separate tables were created per client.
* No unrelated files or styling were changed.
* The project builds without TypeScript errors.

If any item fails, Claude must fix it before saying the task is complete.

## Project file structure rules

Claude must keep the project structure clean and predictable.

Do not place components, SQL files, tests, scripts, or utilities randomly.

Follow these folder rules unless explicitly instructed otherwise.

## Component structure

Every reusable component must have its own folder inside `components`.

Use this structure:

```txt
components/Footer/index.tsx
components/Navigation/index.tsx
components/Button/index.tsx
components/Modal/index.tsx
components/DashboardCard/index.tsx
```

Do not create loose component files like:

```txt
components/Footer.tsx
components/Navigation.tsx
components/Button.tsx
```

If a component needs local subcomponents, styles, types, or helpers, keep them inside the same component folder.

Example:

```txt
components/Navigation/index.tsx
components/Navigation/MobileMenu.tsx
components/Navigation/DesktopMenu.tsx
components/Navigation/types.ts
```

Shared utilities must not be placed inside component folders unless they are only used by that component.

## Page-specific components

If a component is only used by one page, place it close to that page or inside a clear feature folder.

Example:

```txt
app/dashboard/_components/StatsCard.tsx
app/dashboard/_components/RecentBookings.tsx
```

Reusable global components must stay in:

```txt
components/
```

## SQL file structure

All SQL files must be stored in one dedicated folder.

Use:

```txt
scripts/sql/
```

Examples:

```txt
scripts/sql/boost.sql
scripts/sql/040003030.sql
scripts/sql/create-business-tables.sql
scripts/sql/add-booking-indexes.sql
```

Do not place SQL files in random folders.

Bad:

```txt
app/sql/
db/
utils/migration.sql
migration.sql
```

If SQL files are migrations, use clear ordered names.

Example:

```txt
scripts/sql/001_create_business_tables.sql
scripts/sql/002_create_booking_tables.sql
scripts/sql/003_add_indexes.sql
```

## Script structure

All scripts must be placed inside:

```txt
scripts/
```

Examples:

```txt
scripts/sql/
scripts/jobs/
scripts/seed/
scripts/utils/
```

Do not put scripts inside `app`, `components`, or random root files unless explicitly needed.

## Test structure

All tests must be placed inside one dedicated test folder.

Use:

```txt
tests/
```

Tests should mirror the project structure.

Examples:

```txt
tests/components/footer.test.ts
tests/components/navigation.test.ts
tests/pages/homepage.test.ts
tests/pages/dashboard.test.ts
tests/api/bookings.test.ts
tests/utils/format-date.test.ts
```

Do not spread tests randomly across the project.

Bad:

```txt
components/Footer.test.tsx
app/page.test.tsx
utils/test-format-date.ts
```

## Test naming rules

Use clear test file names:

```txt
footer.test.ts
navigation.test.ts
homepage.test.ts
bookings-api.test.ts
```

Avoid unclear names:

```txt
test1.ts
new-test.ts
final-test.ts
```

Because apparently humans keep inventing filenames like “final_final_real.ts”, and we are not doing that here.

## Required folder examples

The project should generally follow this structure:

```txt
app/
components/
lib/
scripts/
scripts/sql/
scripts/jobs/
scripts/seed/
tests/
tests/components/
tests/pages/
tests/api/
tests/utils/
prisma/
public/
```

## Before creating a new file

Before creating a new file, Claude must check:

* Is this a reusable component?

  * Put it in `components/ComponentName/index.tsx`.

* Is this a page-only component?

  * Put it in the page `_components` folder.

* Is this SQL?

  * Put it in `scripts/sql/`.

* Is this a script?

  * Put it in `scripts/`.

* Is this a test?

  * Put it in `tests/` and mirror the project structure.

* Is this shared backend logic?

  * Put it in `lib/`.

* Is this public static asset?

  * Put it in `public/`.

Do not create files in the root unless the file is a standard project config file.

## Footer
Design & development by Intenzze ska inte tas bort i footer
