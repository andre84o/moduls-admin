# Restaurant Booking module

This document is the source of truth for the Restaurant Booking product in `moduls-admin`.

Its purpose is to prevent duplicate implementation work and to make it clear what already exists, where it lives, how the SaaS/tenant boundaries work, and what is still intentionally unfinished.

> Last verified against branch `fix/restaurant-catering-gating` on 2026-09-04.

## Product boundary

Restaurant Booking is a separate paid product from Rental Booking.

Customer-facing product rules:

- `RESTAURANT` is the restaurant management/content module.
- `RESTAURANT_BOOKING` is the Restaurant Booking add-on/product.
- `RENTAL_BOOKING` is a different product and must never be enabled just because Restaurant Booking is enabled.
- `BOOKING` is the shared internal booking engine. It is technical infrastructure and is not exposed as a customer-facing Super Admin product toggle.

Restaurant Booking is considered enabled only when all three are available for the business:

1. internal `BOOKING`
2. `RESTAURANT`
3. feature access `RESTAURANT_BOOKING`

The main capability guards live in:

- `modules/restaurant-booking/guards.ts`
  - `requireRestaurantBooking()` for authenticated admin access
  - `isRestaurantBookingEnabledForBusiness(businessId)` for server-side public capability checks

## SaaS / tenant isolation

Restaurant Booking is multi-tenant. Every restaurant-specific database model contains a `businessId` and reads/writes are scoped by that business.

Admin flows do **not** trust a client-supplied `businessId`. The business is resolved from authenticated server access through `requireRestaurantBooking()`.

Sessionless/public flows also do **not** accept a client-supplied `businessId`. They use:

- `lib/public-tenant.ts`
- `resolvePublicBusinessId()`

Resolution order:

1. configured `PUBLIC_BUSINESS_ID`
2. otherwise the only business in the database, when exactly one exists
3. otherwise no tenant is selected and the public operation fails safely

Do not replace this with a `businessId` query parameter or request-body field.

## Database / Prisma

Restaurant-specific Prisma models are defined in:

- `prisma/restaurant-booking.prisma`

The generic booking lifecycle remains in the shared core `Booking` model. Restaurant-specific fields are stored separately.

### `RestaurantBookingSettings`

Table: `restaurant_booking_settings`

One row per business (`businessId` is unique).

Current fields:

- `timezone`, default `Europe/Stockholm`
- `slotIntervalMin`, default `30`
- `defaultDurationMin`, default `120`
- `turnaroundMin`, default `0`
- `minLeadTimeMin`, default `60`
- `bookingHorizonDays`, default `60`
- `maxPartySize`, default `12`
- `confirmationMode`
  - `REQUEST`
  - `AUTO_CONFIRM`
- `allowTableCombinations`, default `true`

### `RestaurantServicePeriod`

Table: `restaurant_service_periods`

Defines recurring service/booking windows per weekday.

Current fields:

- `businessId`
- `weekday` (`0`–`6`)
- `startMinute`
- `endMinute`

Current model does **not** have an `active` flag, name, or sort-order field. A service period is currently enabled by existing and disabled by deleting it.

### `RestaurantBlockedPeriod`

Table: `restaurant_blocked_periods`

Used for exceptions such as closed evenings, private events, holidays, etc.

Fields:

- `businessId`
- `startAt`
- `endAt`
- optional `reason`

### `RestaurantZone`

Table: `restaurant_zones`

Represents logical restaurant areas such as dining room, terrace, bar, etc.

Fields include:

- `businessId`
- `name`
- `active`
- `sortOrder`

Zone names are unique per business.

### `RestaurantTable`

Table: `restaurant_tables`

Fields include:

- `businessId`
- optional `zoneId`
- `name`
- `minSeats`
- `maxSeats`
- optional `combinationGroup`
- `active`
- `sortOrder`

Table names are unique per business.

`combinationGroup` is used to define tables that are physically allowed to be combined.

### `RestaurantBookingDetail`

Table: `restaurant_booking_details`

Restaurant subtype for a shared core `Booking`.

Fields:

- `businessId`
- unique `bookingId`
- optional `guestPhone`
- `partySize`

Generic booking fields such as guest name, guest email, start/end time, status and notes stay in the shared `Booking` model.

### `BookingTable`

Table: `booking_tables`

Links a restaurant booking detail to one or more restaurant tables.

Fields:

- `businessId`
- `restaurantBookingId`
- `tableId`

There is a unique constraint on `(restaurantBookingId, tableId)`.

## Migrations already created

Do not create replacement migrations for these features without first checking the existing migration history.

Restaurant Booking related migrations currently include:

- `prisma/migrations/20260904133000_add_restaurant_booking_backend/`
  - initial restaurant booking settings, zones, tables, booking detail and table-link backend
- `prisma/migrations/20260904160000_separate_rental_booking_product/`
  - separates `RENTAL_BOOKING` from `RESTAURANT_BOOKING`
- `prisma/migrations/20260904170000_add_restaurant_availability/`
  - restaurant availability/service-period/blocked-period support and timezone

Also related to the surrounding product structure:

- `prisma/migrations/20260903000000_add_restaurant_project_type/`

Always inspect the deployed Prisma migration state before applying or replacing migrations.

## Module files

Current server/domain implementation:

```text
modules/restaurant-booking/
├── actions.ts
├── availability.ts
├── components/
│   └── restaurant-booking-widget.tsx
├── guards.ts
├── public.ts
├── queries.ts
├── schedule-actions.ts
├── table-assignment.ts
├── time.ts
├── types.ts
└── README.md
```

### `guards.ts`

Product and tenant access boundary.

Do not bypass this file for admin Restaurant Booking writes.

### `types.ts`

Shared Restaurant Booking types and defaults.

Contains the canonical default booking settings used when a business has no explicit settings row.

### `queries.ts`

Authenticated/admin read layer.

Current exported reads:

- `getRestaurantBookingSettings()`
- `getRestaurantServicePeriods()`
- `getRestaurantBlockedPeriods()`
- `getRestaurantZonesWithTables()`
- `getUnzonedRestaurantTables()`
- `getRestaurantBookings()`

All real-data queries are scoped to the authenticated `businessId`.

### `actions.ts`

Authenticated/admin write layer.

Current exported actions:

- `saveRestaurantBookingSettings()`
- `createRestaurantZone()`
- `updateRestaurantZone()`
- `createRestaurantTable()`
- `updateRestaurantTable()`
- `createRestaurantBooking()`
- `setRestaurantBookingStatus()`
- `setRestaurantBookingTables()`

Writer actions require Restaurant Booking and OWNER/ADMIN access.

Important distinction: `createRestaurantBooking()` is the current **admin manual booking** action. It creates a confirmed booking using the configured default duration, but it is not the same implementation as the safer public atomic booking flow. See Known limitations below.

### `schedule-actions.ts`

Authenticated/admin schedule and availability configuration.

Current exports:

- `saveRestaurantBookingTimezone()`
- `createRestaurantServicePeriod()`
- `deleteRestaurantServicePeriod()`
- `createRestaurantBlockedPeriod()`
- `deleteRestaurantBlockedPeriod()`
- `previewRestaurantAvailability()`

Service periods currently support create/delete, not an in-place update action.

### `availability.ts`

Availability engine.

Main function:

- `getRestaurantAvailabilityForBusiness({ businessId, date, partySize, now? })`

It calculates possible slots from:

- restaurant timezone
- configured service periods
- slot interval
- default booking duration
- lead time
- booking horizon
- blocked periods
- max party size
- active tables
- existing active restaurant bookings
- assigned tables
- turnaround time
- table combinations

Statuses currently considered capacity-blocking:

- `PENDING`
- `PAYMENT_PENDING`
- `CONFIRMED`

`DECLINED` and `CANCELLED` therefore stop consuming capacity automatically on the next availability calculation.

Availability is calculated on demand. There is no cron-based synchronization required between admin settings and available slots.

### `table-assignment.ts`

Canonical automatic table selector:

- `chooseRestaurantTables()`

Selection strategy:

1. remove occupied tables
2. prefer the smallest single table that fits `partySize`
3. if no single table fits and combinations are enabled, only combine tables sharing the same non-null `combinationGroup`
4. prefer the combination with the smallest total capacity
5. when capacities are equal, prefer fewer tables

Do not implement a second public table-selection algorithm elsewhere. Public booking creation should use this helper so availability and assignment do not drift into competing definitions of reality.

### `time.ts`

Timezone/date helpers used by the public booking transaction.

Contains shared helpers for timezone-safe local/UTC conversion and date calculations.

### `public.ts`

Sessionless/public server layer.

Exports:

- `getPublicRestaurantAvailability()`
- `createPublicRestaurantBooking()`

Public booking creation:

- resolves tenant server-side
- checks Restaurant Booking entitlement
- validates party size and requested time
- checks lead time and booking horizon
- verifies the selected time belongs to a service-period slot
- rejects blocked periods
- re-reads active capacity inside the transaction
- applies turnaround rules
- automatically selects table(s)
- creates `Booking`
- creates `RestaurantBookingDetail`
- creates `BookingTable` links
- uses a Prisma `Serializable` transaction
- retries Prisma `P2034` serialization/write-conflict failures up to three attempts

Confirmation result:

- `REQUEST` → `PENDING`
- `AUTO_CONFIRM` → `CONFIRMED`

This atomic public flow is the safe base for real guest bookings.

## Public API routes

These routes exist in `moduls-admin`. They do not create a customer-facing page by themselves.

### Availability

```http
GET /api/public/restaurant-booking/availability?date=YYYY-MM-DD&partySize=2
```

File:

- `app/api/public/restaurant-booking/availability/route.ts`

Input:

- `date`: required `YYYY-MM-DD`
- `partySize`: required positive integer

Behavior:

- returns `400` for invalid input
- returns `404` when a safe public tenant cannot be configured/resolved
- returns availability with `Cache-Control: no-store`

### Create booking

```http
POST /api/public/restaurant-booking/book
Content-Type: application/json
```

File:

- `app/api/public/restaurant-booking/book/route.ts`

Current body:

```json
{
  "guestName": "Alex Johnson",
  "guestEmail": "alex@example.com",
  "guestPhone": "+46 70 123 45 67",
  "partySize": 2,
  "startAt": "2026-09-10T17:00:00.000Z",
  "notes": "Optional request"
}
```

Success:

- HTTP `201`
- returns `ok: true`, `bookingId`, and status (`PENDING` or `CONFIRMED`)

Known booking/business conflicts currently return HTTP `409` with an error message.

The request body must never be extended with a trusted client-controlled `businessId`. Public tenant resolution remains server-side.

## Reusable booking widget

Reusable customer-flow component:

- `modules/restaurant-booking/components/restaurant-booking-widget.tsx`
- component: `RestaurantBookingWidget`

It is intentionally adapter-based and does not hard-code an API implementation.

Main props:

```ts
{
  title?: string;
  subtitle?: string;
  maxPartySize?: number;
  loadAvailability: ({ date, partySize }) => Promise<RestaurantBookingAvailability>;
  submitBooking: (input) => Promise<RestaurantBookingSubmitResult>;
}
```

Current UX states/features:

- guest count selector
- date selection
- availability loading state
- available time selection
- empty / fully booked state
- error state
- manual availability refresh
- guest name
- guest phone
- guest email
- optional special request
- reservation summary
- booking submit/loading state
- `PENDING` success state
- `CONFIRMED` success state
- responsive/mobile layout

The adapter boundary exists specifically so a customer repo can later provide real API calls without rebuilding the UI component.

## Private Super Admin preview

Private preview route:

```text
/admin/super/restaurant-booking-demo
```

Files:

- `app/admin/super/restaurant-booking-demo/page.tsx`
- `app/admin/super/restaurant-booking-demo/_components/restaurant-booking-demo.tsx`

The entire `/admin/super` segment is protected by Super Admin authentication.

The preview:

- renders the reusable `RestaurantBookingWidget`
- uses mock availability
- uses a mock submit adapter
- does **not** create database bookings
- exists only to review customer-facing UX/design

There is also a link from Super Admin → Modules to open this preview.

Do not confuse this preview with the real public API flow.

## Admin UI

Restaurant Booking admin UI currently lives mainly in:

- `app/admin/_components/sections/bookings/restaurant-bookings.tsx`
- `app/admin/_components/sections/bookings/restaurant-booking-product.tsx`
- `app/admin/_components/sections/bookings/restaurant-availability-admin.tsx`
- `app/admin/_components/sections/bookings/bookings-hub.tsx`

The booking product separates Restaurant Booking from Rental Booking. When both products are active, the booking hub can expose both domains. Enabling one booking product must not implicitly expose the other.

## Automatic synchronization behavior

There is no separate synchronization worker for Restaurant Booking availability.

When an availability request is made, the engine reads the current database state. Therefore changes to these records affect subsequent availability calculations automatically:

- settings
- timezone
- service periods
- blocked periods
- active tables
- table capacities
- table combination groups
- existing blocking bookings
- table assignments

Example: changing a booking to `CANCELLED` removes it from the list of capacity-blocking statuses, so its table capacity becomes available again on the next availability calculation.

Existing bookings are not automatically deleted or rewritten merely because an admin later changes service periods, table configuration, or other availability rules. Existing reservation conflicts must be handled intentionally rather than silently destroying guest bookings.

## Known limitations / intentionally unfinished

Check this section before creating a new feature. These are known gaps, not forgotten duplicate tasks.

### 1. Customer public-page integration is NOT done

`moduls-admin` has the backend API and reusable widget, but no real customer-facing page has been created here.

The intended architecture is for a customer site/repo, for example `lerustique`, to render the widget and connect its adapters to the real booking endpoints. Do not turn `moduls-admin` into the public restaurant site.

### 2. Public cancellation is NOT implemented

There is no guest cancellation token/link or public cancellation API yet.

Admin can set Restaurant Booking status to `CANCELLED`, but guests cannot currently cancel securely themselves.

### 3. Rescheduling is NOT implemented

There is no atomic `rescheduleRestaurantBooking()` flow yet.

A correct reschedule implementation must re-check availability and allocate tables atomically for the new time before moving the reservation.

### 4. Re-confirming cancelled/declined bookings needs hardening

`setRestaurantBookingStatus()` can change status, but restoring an inactive booking to a capacity-blocking status does not currently perform the same full atomic capacity re-check as public booking creation.

Do not build UI that casually restores a cancelled booking to `CONFIRMED` until this is hardened.

### 5. Admin manual booking is not yet unified with the public allocator

`createRestaurantBooking()` in `actions.ts` is an admin/manual flow. It currently creates a confirmed booking with the configured duration but is not the same transaction/availability/auto-table-allocation flow as `createPublicRestaurantBooking()`.

Before production-grade manual booking, either:

- route admin creation through the same safe allocator, or
- make an explicit admin override mode with clear conflict semantics.

Do not create a third booking-creation implementation.

### 6. Existing-booking conflict warnings are NOT implemented

If admin changes service periods, closes a time, disables a table/zone, or otherwise makes existing future reservations conflict with the new configuration, the system does not yet provide a dedicated conflict-warning/remediation workflow.

Existing reservations should not be silently deleted.

### 7. Service periods currently have create/delete only

The current Prisma model has no `active` flag and the current server actions expose create/delete rather than update/toggle.

Do not assume service periods support enable/disable unless the schema/actions are changed deliberately.

### 8. Zone activity is not a complete availability rule yet

Tables themselves have `active` and availability uses active tables. A zone also has an `active` field, but zone activity is not currently a fully enforced public availability boundary in all paths.

If zone disabling is intended to remove all tables in that zone from public availability, harden this deliberately rather than adding another parallel filter somewhere else.

### 9. Email notifications are NOT implemented

Still needed later:

- guest request received
- guest confirmed
- guest declined
- guest cancelled
- restaurant/admin notification
- reschedule notifications

### 10. Floor plan is NOT implemented

Future floor-plan work is presentation/admin-assignment tooling. It must reuse the existing table records and must not become a second availability source of truth.

### 11. End-to-end booking tests are still needed

Important scenarios include:

- service period boundaries
- blocked periods
- max party size
- no capacity
- table combinations
- turnaround
- simultaneous/concurrent booking attempts
- REQUEST vs AUTO_CONFIRM
- cancellation freeing capacity
- timezone/DST transitions
- feature disabled
- multi-tenant isolation

## Rules for future development

Before adding Restaurant Booking code:

1. Read this README.
2. Check the existing files in `modules/restaurant-booking/`.
3. Reuse `requireRestaurantBooking()` for authenticated tenant/product gating.
4. Reuse `resolvePublicBusinessId()` for sessionless public tenant resolution.
5. Reuse the availability engine instead of implementing slot rules in a UI component.
6. Reuse `chooseRestaurantTables()` instead of creating another table allocator.
7. Keep public booking creation atomic and concurrency-safe.
8. Keep Restaurant Booking and Rental Booking product entitlements separate.
9. Never accept a trusted `businessId` from a public/client request.
10. Update this README when adding/removing DB models, migrations, API routes, actions, components, or lifecycle behavior.

## Current architecture summary

```text
Customer site / future public integration
        │
        │  widget adapters
        ▼
RestaurantBookingWidget
        │
        ├── GET /api/public/restaurant-booking/availability
        │       └── getPublicRestaurantAvailability()
        │               └── getRestaurantAvailabilityForBusiness()
        │
        └── POST /api/public/restaurant-booking/book
                └── createPublicRestaurantBooking()
                        ├── tenant/product checks
                        ├── availability rules
                        ├── chooseRestaurantTables()
                        └── Serializable transaction
                                ├── Booking
                                ├── RestaurantBookingDetail
                                └── BookingTable

Admin
  └── requireRestaurantBooking()
        ├── queries.ts
        ├── actions.ts
        └── schedule-actions.ts

Shared SaaS database
  └── all restaurant-specific rows scoped by businessId
```

The database and domain engine are the source of truth. Public/customer UI should consume them rather than reimplementing booking rules client-side.
