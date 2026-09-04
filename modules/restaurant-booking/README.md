# Restaurant Booking module

This is the source of truth for Restaurant Booking in `moduls-admin`.

The goal is simple: before adding Restaurant Booking code, check this file first so we do not rebuild database models, availability rules, APIs, table allocation or lifecycle logic that already exists.

> Last verified against `fix/restaurant-catering-gating` on 2026-09-04.

## Product boundary

Restaurant Booking is its own SaaS product.

- `RESTAURANT` = restaurant content/management module.
- `RESTAURANT_BOOKING` = restaurant reservation product/add-on.
- `RENTAL_BOOKING` = separate rental booking product.
- `BOOKING` = shared internal technical booking engine. It is not a customer-facing product toggle.

Restaurant Booking requires the Restaurant module and the Restaurant Booking feature entitlement. Enabling Restaurant Booking must never enable Rental Booking.

## SaaS / tenant isolation

All Restaurant Booking data is tenant-owned by `businessId`.

Admin writes resolve the current business server-side through `requireRestaurantBooking()`.

Public/sessionless writes do **not** trust `businessId` from a browser request. Public tenant resolution is handled by:

- `lib/public-tenant.ts`
- `resolvePublicBusinessId()`

Never add a trusted client-controlled `businessId` to Restaurant Booking public APIs.

## Database / Prisma

Restaurant-specific models live in:

- `prisma/restaurant-booking.prisma`

The shared core reservation record remains `Booking` in the main Prisma schema.

### `RestaurantBookingSettings`

Table: `restaurant_booking_settings`

One row per business.

Current settings:

- `timezone`
- `slotIntervalMin`
- `defaultDurationMin`
- `turnaroundMin`
- `minLeadTimeMin`
- `bookingHorizonDays`
- `maxPartySize`
- `confirmationMode`
  - `REQUEST`
  - `AUTO_CONFIRM`
- `allowTableCombinations`

Default timezone is `Europe/Stockholm`.

### `RestaurantServicePeriod`

Table: `restaurant_service_periods`

Recurring bookable service windows.

Fields:

- `businessId`
- `weekday`
- `startMinute`
- `endMinute`

There is currently no `active` flag. A period is enabled by existing and disabled by deleting it.

### `RestaurantBlockedPeriod`

Table: `restaurant_blocked_periods`

One-off closures/private events/blocked ranges.

Fields:

- `businessId`
- `startAt`
- `endAt`
- optional `reason`

### `RestaurantZone`

Table: `restaurant_zones`

Examples: dining room, terrace, bar.

Fields include:

- `businessId`
- `name`
- `active`
- `sortOrder`

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

`combinationGroup` defines which tables may physically be joined.

### `RestaurantBookingDetail`

Table: `restaurant_booking_details`

Restaurant-specific one-to-one subtype of the shared `Booking` row.

Fields:

- `businessId`
- unique `bookingId`
- optional `guestPhone`
- `partySize`

Guest name, email, start/end, status and notes stay in the shared `Booking` model.

### `BookingTable`

Table: `booking_tables`

Connects one Restaurant Booking to one or more tables.

Fields:

- `businessId`
- `restaurantBookingId`
- `tableId`

## Migrations already created

Do not create replacement migrations for these without checking migration history first.

- `prisma/migrations/20260904133000_add_restaurant_booking_backend/`
- `prisma/migrations/20260904160000_separate_rental_booking_product/`
- `prisma/migrations/20260904170000_add_restaurant_availability/`

Related product migration:

- `prisma/migrations/20260903000000_add_restaurant_project_type/`

## Module map

```text
modules/restaurant-booking/
├── README.md
├── actions.ts
├── availability.ts
├── booking-slot.ts
├── components/
│   └── restaurant-booking-widget.tsx
├── guards.ts
├── lifecycle-actions.ts
├── public.ts
├── queries.ts
├── schedule-actions.ts
├── table-assignment.ts
├── time.ts
└── types.ts
```

## Canonical capability guard

File:

- `guards.ts`

Main functions:

- `requireRestaurantBooking()`
- `isRestaurantBookingEnabledForBusiness(businessId)`

Do not bypass this boundary for Restaurant Booking admin writes.

## Canonical availability engine

File:

- `availability.ts`

Main function:

- `getRestaurantAvailabilityForBusiness({ businessId, date, partySize, now? })`

Availability is calculated from current DB state on demand. There is no synchronization cron required.

It considers:

- timezone
- service periods
- slot interval
- booking duration
- lead time
- booking horizon
- blocked periods
- max party size
- active tables
- active zones
- existing active Restaurant Bookings
- turnaround time
- table assignments
- table combinations

Capacity-blocking statuses:

- `PENDING`
- `PAYMENT_PENDING`
- `CONFIRMED`

`DECLINED` and `CANCELLED` do not consume capacity.

## Canonical transactional slot allocator

File:

- `booking-slot.ts`

Main function:

- `allocateRestaurantBookingSlot()`

This is the canonical validator/allocator for a specific Restaurant Booking time.

It is used by:

- public booking creation
- admin/manual booking creation
- admin rescheduling
- reactivation of cancelled/declined reservations

It validates:

- party size
- public lead time and booking horizon
- admin booking is not in the past
- service-period membership
- slot interval alignment
- blocked periods
- active tables
- active zones
- turnaround overlap
- existing Restaurant Booking conflicts
- usable existing table assignments
- table capacity
- table combinations

Do **not** create another slot validation/allocation algorithm for Restaurant Booking.

## Canonical automatic table selection

File:

- `table-assignment.ts`

Function:

- `chooseRestaurantTables()`

Strategy:

1. remove occupied tables
2. prefer smallest fitting single table
3. if needed and enabled, combine tables from the same `combinationGroup`
4. prefer smallest total capacity
5. for equal capacity, prefer fewer tables

## Admin lifecycle actions

File:

- `lifecycle-actions.ts`

Canonical admin lifecycle functions:

### `createManagedRestaurantBooking()`

Creates a manual admin reservation using the canonical slot allocator.

It:

- checks availability
- validates service hours and blocked periods
- automatically allocates table(s)
- creates `Booking`
- creates `RestaurantBookingDetail`
- creates `BookingTable`
- runs in a serializable transaction
- creates the admin reservation as `CONFIRMED`

The admin UI uses this action.

### `rescheduleRestaurantBooking()`

Atomic admin reschedule.

It:

- only moves an active reservation
- excludes the reservation itself from conflict checks
- validates the new time through the canonical allocator
- updates start/end
- replaces old table links with the newly allocated table(s)
- runs in a serializable transaction

### `setManagedRestaurantBookingStatus()`

Supported managed statuses:

- `PENDING`
- `CONFIRMED`
- `DECLINED`
- `CANCELLED`

Cancelling/declining immediately removes the reservation from future availability calculations.

When an inactive booking is reactivated into a capacity-blocking status, the action first re-runs canonical capacity validation and reassigns valid table(s). A cancelled reservation therefore cannot simply overwrite a table that has since been booked by someone else.

## Admin UI lifecycle integration

Main UI:

- `app/admin/_components/sections/bookings/restaurant-bookings.tsx`

The Restaurant Booking admin now uses lifecycle-specific actions for:

- manual booking creation
- confirm
- decline
- cancel
- reactivate
- reschedule

Rescheduling asks for a new date/time and the server automatically reallocates tables.

Reactivation is exposed for `CANCELLED` and `DECLINED` bookings and performs a capacity recheck first.

The UI still supports explicit manual table assignment through:

- `setRestaurantBookingTables()`

## Older admin write layer

File:

- `actions.ts`

It still contains settings, zones, tables and explicit table-assignment actions.

Important: `createRestaurantBooking()` in this file is an older manual-creation implementation. The current admin UI must use `createManagedRestaurantBooking()` from `lifecycle-actions.ts` instead.

Do not build new UI against the older `createRestaurantBooking()` path. It should eventually be removed/deprecated after all references are confirmed gone.

## Admin reads

File:

- `queries.ts`

Main exports:

- `getRestaurantBookingSettings()`
- `getRestaurantServicePeriods()`
- `getRestaurantBlockedPeriods()`
- `getRestaurantZonesWithTables()`
- `getUnzonedRestaurantTables()`
- `getRestaurantBookings()`

All real-data queries are tenant-scoped.

## Schedule / availability administration

File:

- `schedule-actions.ts`

Exports:

- `saveRestaurantBookingTimezone()`
- `createRestaurantServicePeriod()`
- `deleteRestaurantServicePeriod()`
- `createRestaurantBlockedPeriod()`
- `deleteRestaurantBlockedPeriod()`
- `previewRestaurantAvailability()`

## Public server layer

File:

- `public.ts`

Exports:

- `getPublicRestaurantAvailability()`
- `createPublicRestaurantBooking()`

Public booking creation uses the same canonical transactional allocator as the admin lifecycle.

Confirmation behavior:

- `REQUEST` → `PENDING`
- `AUTO_CONFIRM` → `CONFIRMED`

## Public API routes

### Availability

```http
GET /api/public/restaurant-booking/availability?date=YYYY-MM-DD&partySize=2
```

File:

- `app/api/public/restaurant-booking/availability/route.ts`

### Create booking

```http
POST /api/public/restaurant-booking/book
Content-Type: application/json
```

File:

- `app/api/public/restaurant-booking/book/route.ts`

Current request body:

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

The public request body must not contain a trusted `businessId`.

## Reusable public booking component

File:

- `components/restaurant-booking-widget.tsx`

Component:

- `RestaurantBookingWidget`

Adapter contract:

```ts
{
  loadAvailability: ({ date, partySize }) => Promise<RestaurantBookingAvailability>;
  submitBooking: (input) => Promise<RestaurantBookingSubmitResult>;
}
```

Current UX includes:

- guest count
- date
- loading
- available times
- fully booked state
- errors
- contact details
- special request
- summary
- submit state
- pending/confirmed result
- mobile layout

## Private Super Admin preview

Route:

```text
/admin/super/restaurant-booking-demo
```

The preview:

- is Super Admin protected
- renders the reusable public widget
- uses mock availability
- uses mock submit
- does not write bookings to DB

## Rental Booking separation

Rental Booking and Restaurant Booking must not mutate each other's subtype bookings.

Rental action wrappers contain Restaurant Booking guards before rental status/delete operations.

Never remove these domain boundaries just because both products share the core `Booking` table.

## What is finished

- SaaS tenant scoping
- product separation
- Restaurant Booking DB models
- settings
- zones
- tables
- service periods
- blocked periods
- availability calculation
- automatic table allocation
- public availability API
- public create-booking API
- serializable public creation
- reusable public widget
- private Super Admin preview
- canonical shared slot allocator
- safe admin manual booking creation
- safe admin cancellation/decline
- capacity-safe admin reactivation
- atomic admin rescheduling
- admin lifecycle UI integration

## Known remaining work

### Public customer-site integration

The real customer page is intentionally not implemented in `moduls-admin`.

A customer repo such as `lerustique` should render `RestaurantBookingWidget` and connect its adapters to the real APIs.

### Public cancellation

Not implemented yet.

Needs a secure guest token/link and public cancellation endpoint.

### Public rescheduling

Not implemented yet.

Should reuse the canonical allocator and require secure guest authorization.

### Notifications

Still needed for the complete Restaurant Booking lifecycle:

- booking request received
- admin/new reservation notification
- confirmed
- declined
- cancelled
- rescheduled

### Existing-booking conflict remediation

If admin changes service windows or disables inventory that affects an already active future booking, the system should provide a dedicated warning/remediation workflow rather than silently changing or deleting the guest reservation.

The canonical allocator already fails closed when an overlapping active booking references unusable table inventory.

### Manual table-assignment hardening

The explicit `setRestaurantBookingTables()` path is separate from the automatic allocator. It already validates capacity and time conflicts, but it should continue to be reviewed so table and zone activity rules remain identical to automatic allocation.

### Legacy manual create cleanup

`actions.ts:createRestaurantBooking()` is no longer the intended admin creation path. Remove/deprecate it after confirming no external call sites remain.

### Tests

Production test coverage should include:

- simultaneous booking attempts
- full restaurant
- blocked periods
- turnaround
- single table
- table combinations
- inactive zone
- inactive table
- cancellation freeing capacity
- reactivation after capacity was taken
- reschedule conflicts
- timezone/DST
- feature disabled
- tenant A cannot touch tenant B

### Floor plan

Drag/drop floor plan is intentionally later work.

It may store table positions/rotation/shape and zone layout, but the floor plan must never become the source of truth for availability. `RestaurantTable`, bookings and the allocator remain authoritative.

## Rules for future implementation

1. Check this README before adding Restaurant Booking code.
2. Never trust client `businessId`.
3. Use `requireRestaurantBooking()` for admin Restaurant Booking access.
4. Use `allocateRestaurantBookingSlot()` for creation, reschedule and reactivation capacity decisions.
5. Use `chooseRestaurantTables()` rather than creating another table-selection algorithm.
6. Do not couple Restaurant Booking and Rental Booking product enablement.
7. Do not silently rewrite/delete existing reservations when configuration changes.
8. Keep the public customer page in the customer repo, not inside `moduls-admin`.
9. Update this README when the architecture changes.
