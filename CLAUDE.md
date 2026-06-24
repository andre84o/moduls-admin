@AGENTS.md

# AGENTS.md / CLAUDE.md

Use components from:

https://ui.shadcn.com

## Project base / SaaS template rule

This project should be treated as a reusable SaaS base for future small-business projects, not as a one-off client project.

Core functionality must stay generic and reusable.

Core includes:

* Auth
* Business
* BusinessMember
* Users
* Roles
* Admin shell
* Module gating
* Media/storage infrastructure
* Audit logs
* Settings
* Storage setup
* Tenant isolation
* Super Admin module control

Do not hardcode client-specific names, routes, business logic, demo data, or UI text into the core system.

All business-owned data must always be scoped by `businessId`.

Never read, update, delete, list, or attach business-owned data by `id` alone.

Always resolve `businessId` on the server from the logged-in user and their `BusinessMember` access.

Optional features such as booking, CRM, rentals, services, staff, invoices, products, website pages, and custom tools must be treated as modules that can be enabled per business.

Before adding a new feature, decide whether it belongs to:

1. Core SaaS foundation
2. Optional module
3. Client-specific customization

Do not mix these layers.

## Modular SaaS architecture

This repo may contain multiple optional business modules in the same codebase.

Core must stay generic and reusable.

Optional modules may include:

* Rental
* Booking
* CRM
* Invoice
* Products
* Website
* Staff
* Services
* CollectedHomes or real-estate specific tools
* Custom client tools

Rules:

* Core may not depend on optional modules.
* Optional modules may depend on core.
* Optional modules should not depend tightly on each other.
* Each module must have its own routes, queries, actions, components, and guards.
* Do not place all module logic in shared files like `lib/actions.ts` or `lib/queries.ts`.
* Disabled modules must not load data, show navigation, or allow server actions.
* Heavy modules must only load on their own routes/pages.
* Do not fetch data for all modules on the main admin page.
* Every business-owned module table must include `businessId`.
* Every module read/write/delete must be scoped by server-resolved `businessId`.
* Every module action must use the correct module guard, for example `requireModule(ProjectType.RENTAL)`.
* Keep client-specific functionality inside its module, never in core.
* Do not build module-specific UI directly into the core admin shell unless it is gated by enabled modules.

## Shared Supabase + Prisma Architecture Rules

This project uses one shared Supabase database for multiple small client projects.

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
* Media/storage infrastructure
* Staff management
* Rental system
* Invoice system
* Product system
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
* Product
* Rental
* Property

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

If the project needs invoices, add invoice-specific models inside the invoice module.

If the project needs products, add product-specific models inside the product module.

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

* `SUPER_ADMIN` can access platform-level admin tools and explicitly approved cross-business views.
* `OWNER` owns one business.
* `ADMIN` manages one business.
* `STAFF` has limited access inside one business.

A role must be checked together with `businessId`.

A user being `ADMIN` for one business does not mean they are admin for another business.

## Project model / module enablement

`Project` represents an enabled client module or system inside a business.

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

Enabled module = a `Project` row for the business with status `ACTIVE`.

Disabled module = a `Project` row with status `DISABLED`, or no row at all depending on the project logic.

Do not delete module rows when disabling a module unless explicitly instructed. Prefer setting status to `DISABLED`.

Super Admin module settings may toggle module status per business.

Media/storage infrastructure is core and should not be treated as a free customer-facing module.

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

## Module guard rules

Every optional module must have a server-side module guard.

Use a helper similar to:

```ts
await requireModule(ProjectType.RENTAL)
```

Module examples:

* Properties / rentals writes require `ProjectType.RENTAL`
* Booking writes require `ProjectType.BOOKING`
* CRM/customer writes require `ProjectType.CRM`
* Invoice writes require `ProjectType.INVOICE` if the enum exists
* Product writes require `ProjectType.PRODUCT` or equivalent if the enum exists

Disabled modules must:

* Not show navigation.
* Not load module data.
* Not allow server actions.
* Not allow direct URL or direct action access.

Hiding UI is not security.

Server-side guards are required.

## SUPER_ADMIN rules

`SUPER_ADMIN` access must be explicit.

Claude must not accidentally allow all admins to access all businesses.

Only `SUPER_ADMIN` may query across businesses.

Any cross-business query must include a clear comment explaining why it is platform-level access.

Example:

```ts
// Platform-level access. Only SUPER_ADMIN may view all businesses.
```

Regular `OWNER`, `ADMIN`, and `STAFF` must never access platform-level pages.

Super Admin pages must be protected server-side, not only hidden in navigation.

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

## Supabase Storage and Media rules

Media is core infrastructure, not a standalone free-upload area.

Do not create a general admin Media page where customers can freely upload random files.

Uploads must be contextual and attached to a real owner, for example:

* Property images
* Product images
* Business logo
* Customer documents
* Invoice attachments

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
* `kind`
* `visibility`
* `bucket`
* `path`
* `url`
* `ownerType`
* `ownerId`
* `folder`
* `name`
* `size`
* `width`
* `height`
* `createdAt`
* `updatedAt`

Rules:

* Public images may store a permanent `url`.
* Private documents must use `url = null` and be served through signed URLs.
* Public website images/logos may use public storage.
* Customer documents, contracts, invoices, and internal files must use private storage.
* Media visibility must be decided server-side.
* Never trust `ownerType`, `ownerId`, `folder`, `visibility`, or `path` from the frontend.
* The server must validate that the owner belongs to the resolved `businessId`.
* Delete media only after verifying `id + businessId`.
* Media backend/services/components may remain reusable, but standalone free-upload UI should not be part of core admin.
* Media upload UI should be used contextually inside modules or forms.
* Media components may be inline sections or modals depending on the module need.

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
6. Required module is enabled when the page belongs to an optional module.

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

Booking module routes, queries, and actions must require the booking module to be enabled.

## CRM rules

If the project includes CRM:

Every customer must belong to one business.

Every note, tag, message, task, or activity must include `businessId`.

CRM data must never be shared across businesses.

Customer search must always be filtered by `businessId`.

CRM routes, queries, and actions must require the CRM module to be enabled.

## Rental / Property rules

If the project includes rentals or properties:

* Every property/rental must include `businessId`.
* Property images must use contextual media upload.
* Property media must be attached to the property owner context.
* Public property pages must only expose public active property data.
* Property create/update/delete actions must require the rental module to be enabled.
* Never hardcode rental-specific logic into core.

## Invoice rules

If the project includes invoices:

* Every invoice must include `businessId`.
* Every invoice customer relation must be scoped by `businessId`.
* Invoice files must use private storage unless explicitly public.
* Invoice routes, queries, and actions must require the invoice module to be enabled.
* Do not mix invoice logic into CRM or core unless it is a shared generic helper.

## Audit log rules

Important admin actions should create an `AuditLog` record.

Examples:

* customer created
* booking changed
* media deleted
* user invited
* role changed
* business settings updated
* module enabled or disabled
* invoice created or updated

`AuditLog` must include:

* `id`
* `businessId`
* `userId`
* `action`
* `entityType`
* `entityId`
* `metadata`
* `createdAt`

Cross-business Super Admin actions should either:

* create a platform-level audit log, or
* create a business-scoped audit log for the affected business

depending on the project schema.

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
* module
* property
* invoice
* product

Avoid narrow names unless the project specifically requires them.

Bad:

* salon
* hairdresser
* pizza
* therapist
* rentalOwner
* stefanie
* costastay

## UI text rules

All UI text shown in the interface must be in English unless the project explicitly says otherwise.

This includes:

* buttons
* menus
* labels
* errors
* empty states
* dashboard text
* admin navigation
* form text
* toast messages

Code comments can be in Swedish if useful.

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

## Module file structure

Optional modules should be grouped clearly.

Preferred structure:

```txt
modules/
modules/rental/
modules/booking/
modules/crm/
modules/invoice/
modules/products/
modules/website/
modules/collectedhomes/
```

Each module may contain:

* `actions.ts`
* `queries.ts`
* `components/`
* `types.ts`
* `utils.ts`
* route-specific files where relevant

If the project is not yet using a `modules/` folder, keep module logic clearly separated and do not keep expanding generic shared files forever.

Do not dump all optional module logic into:

* `lib/actions.ts`
* `lib/queries.ts`
* `app/admin/page.tsx`
* `app/admin/_components/admin-shell.tsx`

Those files may orchestrate core behavior, but should not become junk drawers for every module.

## SQL file structure

All SQL files must be stored in one dedicated folder.

Use:

```txt
scripts/sql/
```

Examples:

```txt
scripts/sql/001_create_business_tables.sql
scripts/sql/002_create_booking_tables.sql
scripts/sql/003_add_indexes.sql
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
modules/
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

* Is this module-specific logic?

  * Put it inside the relevant module folder or a clearly named module area.

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

## Performance rules

Do not load every module on the main admin page.

Only load module code and module data when the current route or enabled module needs it.

Avoid large shared admin pages that fetch Rental, Booking, CRM, Invoice, Products, and custom modules at the same time.

Avoid importing heavy client components globally.

Module-specific heavy components should be route-local or dynamically loaded when appropriate.

Disabled modules must not trigger database queries or expensive work.

Keep the admin shell light.

## Work process rules

Keep work isolated.

Use small focused commits.

Do not mix unrelated features in one commit.

Before committing, show changed files and confirm scope.

Do not modify unrelated styling unless explicitly requested.

Do not refactor unrelated code unless explicitly requested.

Do not change existing behavior unless the task requires it.

For larger development tasks, split the work between 5 agents:

1. Inspect current implementation.
2. Implement the change.
3. Review tenant/security boundaries.
4. Review UI/types/build.
5. Produce final summary and next-step risks.

## Required validation before completion

Before marking work as complete, Claude must check:

* Every business-owned model has `businessId`.
* Every business-owned query is scoped by `businessId`.
* No update/delete uses `id` only.
* Auth is checked server-side.
* Role access is checked server-side.
* Module access is checked server-side for optional modules.
* Disabled modules do not load data, show navigation, or allow server actions.
* Supabase service role key is not exposed.
* Storage paths include `businessId`.
* Public routes expose only safe data.
* Admin routes are protected.
* Prisma schema is consistent.
* No separate tables were created per client.
* No unrelated files or styling were changed.
* The project builds without TypeScript errors.
* `npx tsc --noEmit` passes.
* `npm run build` passes.

If any item fails, Claude must fix it before saying the task is complete.

## Footer rule

`Design & development by Intenzze` must not be removed from the footer.
