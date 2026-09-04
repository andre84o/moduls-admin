# Restaurant Booking module

This is the source of truth for Restaurant Booking in `moduls-admin`.

> Last verified against `fix/restaurant-booking-hardening` on 2026-09-04.

## Product boundary

Restaurant Booking is its own SaaS product.

- `RESTAURANT` = restaurant content/management module.
- `RESTAURANT_BOOKING` = restaurant reservation product/add-on.
- `RENTAL_BOOKING` = separate rental booking product.
- `BOOKING` = shared internal technical booking engine, not a customer-facing product toggle.

Restaurant Booking requires the Restaurant module and the Restaurant Booking entitlement. It must never enable or mutate Rental Booking.

## Testing boundary

Restaurant Booking is developed and tested completely inside `moduls-admin` until the whole flow is verified.

Do **not** modify or depend on Le Rustique or another customer repository for Restaurant Booking testing.

The internal preview/test routes in this project are the test surface for the public guest flow.

## Tenant isolation

All Restaurant Booking data is tenant-owned by `businessId`.

Admin writes resolve the current tenant server-side through `requireRestaurantBooking()`.

Public/sessionless requests resolve tenant identity through `resolvePublicBusinessId()` and must never trust a browser-supplied `businessId`.

## Database models

Restaurant-specific Prisma models live in `prisma/restaurant-booking.prisma`.

The shared reservation record remains the core `Booking` model.

### `RestaurantBookingSettings`

Table: `restaurant_booking_settings`

Settings include:

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

Default timezone: `Europe/Stockholm`.

### `RestaurantServicePeriod`

Table: `restaurant_service_periods`

Fields:

- `businessId`
- `weekday`
- `startMinute`
- `endMinute`

There is no `active` flag. A service period is enabled by existing and disabled by deleting it.

### `RestaurantBlockedPeriod`

Table: `restaurant_blocked_periods`

One-off closures/private events.

### `RestaurantZone`

Table: `restaurant_zones`

Fields include `name`, `active` and `sortOrder`.

### `RestaurantTable`

Table: `restaurant_tables`

Fields include:

- optional `zoneId`
- `name`
- `minSeats`
- `maxSeats`
- optional `combinationGroup`
- `active`
- `sortOrder`

A table is effectively bookable only when the table is active and, if it belongs to a zone, that zone is active.

### `RestaurantBookingDetail`

Table: `restaurant_booking_details`

Restaurant-specific subtype keyed by unique `bookingId`.

Stores:

- `guestPhone`
- `partySize`

Guest name/email, start/end, notes and status stay in core `Booking`.

### `BookingTable`

Table: `booking_tables`

Links one Restaurant Booking to one or more tables.

## Existing migrations

Check migration history before adding replacements:

- `20260904133000_add_restaurant_booking_backend`
- `20260904160000_separate_rental_booking_product`
- `20260904170000_add_restaurant_availability`

## Module map

```text
modules/restaurant-booking/
├── README.md
├── actions.ts
├── availability.ts
├── booking-slot.ts
├── components/
│   └── restaurant-booking-widget.tsx
├── configuration-actions.ts
├── conflicts.ts
├── guards.ts
├── lifecycle-actions.ts
├── notifications.ts
├── public.ts
├── queries.ts
├── schedule-actions.ts
├── table-assignment.ts
├── time.ts
└── types.ts
```

## Capability guard

File: `guards.ts`

Canonical functions:

- `requireRestaurantBooking()`
- `isRestaurantBookingEnabledForBusiness(businessId)`

Do not bypass this boundary for admin writes.

## Availability engine

File: `availability.ts`

Main function:

- `getRestaurantAvailabilityForBusiness()`

Availability is calculated from current DB state.

It considers:

- timezone
- service periods
- slot interval
- duration
- lead time
- booking horizon
- blocked periods
- party size
- active tables
- active zones
- active Restaurant Bookings
- turnaround
- table assignments
- table combinations

Capacity-blocking statuses:

- `PENDING`
- `PAYMENT_PENDING`
- `CONFIRMED`

`DECLINED` and `CANCELLED` do not consume capacity.

## Canonical slot allocator

File: `booking-slot.ts`

Function:

- `allocateRestaurantBookingSlot()`

Use it for:

- public booking creation
- admin booking creation
- admin rescheduling
- reactivation

It validates service windows, blocks, capacity, active tables/zones, turnaround and combinations.

Do not create another Restaurant Booking slot allocator.

## Automatic table selection

File: `table-assignment.ts`

Function:

- `chooseRestaurantTables()`

Strategy:

1. remove occupied tables
2. prefer smallest fitting single table
3. combine only tables in the same `combinationGroup` when allowed
4. prefer smallest total capacity
5. for equal capacity, prefer fewer tables

## Admin lifecycle

File: `lifecycle-actions.ts`

Canonical functions:

- `createManagedRestaurantBooking()`
- `rescheduleRestaurantBooking()`
- `setManagedRestaurantBookingStatus()`

The admin UI uses these functions for creation and booking lifecycle changes.

Reactivation always rechecks capacity before the reservation becomes blocking again.

Rescheduling reallocates tables atomically.

## Admin configuration conflict guards

Files:

- `configuration-actions.ts`
- `conflicts.ts`

The admin UI uses safe wrappers that stop configuration changes which would invalidate future active reservations.

Guarded cases include:

- disabling a zone with future active reservations
- changing/disabling an assigned table
- removing a service period used by a future booking
- creating a blocked period over a future booking
- changing timezone while future active bookings exist

The system blocks the unsafe configuration change rather than silently corrupting an existing guest reservation.

## Admin table assignment

File: `actions.ts`

Function:

- `setRestaurantBookingTables()`

Manual table assignment validates:

- booking belongs to tenant
- active booking state
- active table
- active zone
- party-size capacity
- combination rules
- turnaround/time conflicts

Manual assignment must never have weaker inventory rules than automatic allocation.

Legacy `createRestaurantBooking()` and `setRestaurantBookingStatus()` were removed after confirming the admin UI uses the canonical lifecycle actions.

## Notifications

File: `notifications.ts`

Restaurant Booking lifecycle notifications use the shared Resend/`Notification` infrastructure.

Events:

- created/request received
- confirmed
- declined
- cancelled
- rescheduled
- reactivated

Notifications are best-effort and run after a successful booking transaction. Email failure must never roll back a successful reservation.

## Admin reads

File: `queries.ts`

Main reads:

- settings
- service periods
- blocked periods
- zones/tables
- bookings

All real-data reads are tenant-scoped.

## Public server/API layer

File: `public.ts`

Exports:

- `getPublicRestaurantAvailability()`
- `createPublicRestaurantBooking()`

Public routes:

```http
GET /api/public/restaurant-booking/availability?date=YYYY-MM-DD&partySize=2
POST /api/public/restaurant-booking/book
```

Public create uses the canonical transactional allocator.

Confirmation behavior:

- `REQUEST` → `PENDING`
- `AUTO_CONFIRM` → `CONFIRMED`

## Reusable public widget

File:

- `components/restaurant-booking-widget.tsx`

Component:

- `RestaurantBookingWidget`

Current widget supports guest count, date, available slots, contact details, notes, submit/loading states and pending/confirmed results.

## Internal public-flow test surface

Current Super Admin preview route:

```text
/admin/super/restaurant-booking-demo
```

It currently renders the reusable widget with mock adapters and does not DB-write.

The next public-flow testing step is to add/extend an internal test surface in `moduls-admin` that uses the real Restaurant Booking API and test database state. Customer repositories remain untouched.

## What is finished

- tenant scoping
- Restaurant/Rental product separation
- Restaurant Booking DB models
- settings
- zones
- tables
- service periods
- blocked periods
- availability calculation
- automatic table allocation
- manual table assignment with active table/zone validation
- public availability API
- public create API
- serializable booking creation
- reusable public widget
- canonical shared slot allocator
- safe admin creation
- cancel/decline
- capacity-safe reactivation
- atomic rescheduling
- admin lifecycle UI
- lifecycle notifications
- configuration conflict guards
- legacy admin booking/status paths removed

## Remaining work

### Automated tests

High-priority coverage:

- simultaneous attempts for the last capacity
- fully booked restaurant
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

### Real public-flow testing inside `moduls-admin`

The internal public booking test surface should exercise the real API and real DB state without a customer repository.

### Public guest cancellation

Not implemented yet.

Needs secure guest authorization/token and a public cancellation endpoint.

### Public guest rescheduling

Not implemented yet.

Must reuse the canonical allocator and secure guest authorization.

### Floor plan

Do last.

The visual floor plan may store table positions/rotation/shape and zone layout, but it must never become the source of truth for availability.

## Rules for future implementation

1. Check this README before adding Restaurant Booking code.
2. Never trust client `businessId`.
3. Use `requireRestaurantBooking()` for admin access.
4. Use `allocateRestaurantBookingSlot()` for create/reschedule/reactivation capacity decisions.
5. Use `chooseRestaurantTables()` for automatic table selection.
6. Keep manual assignment rules at least as strict as automatic allocation.
7. Do not couple Restaurant Booking and Rental Booking product enablement.
8. Do not silently rewrite/delete existing reservations when configuration changes.
9. Test Restaurant Booking in `moduls-admin`; do not modify Le Rustique for testing.
10. Update this README whenever the architecture changes.
