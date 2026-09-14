# Restaurant Booking module

This is the source of truth for Restaurant Booking in `moduls-admin`.

> Last verified against `fix/restaurant-booking-management-token-hash` on 2026-09-14.

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

The Super Admin preview in this project is the test surface for the real public guest flow and uses the Demo-projekt tenant only.

## Tenant isolation

All Restaurant Booking data is tenant-owned by `businessId`.

Admin writes resolve the current tenant server-side through `requireRestaurantBooking()`.

Normal public booking requests resolve tenant identity server-side through `resolvePublicBusinessId()` and must never trust a browser-supplied `businessId`.

Guest management links are also tenant-safe:

1. the raw capability token contains an encoded **public business slug**, never a trusted client-supplied `businessId`;
2. the server resolves that slug to the tenant root first;
3. every Restaurant Booking token/detail/booking read then includes the resolved `businessId`;
4. only a SHA-256 hash of the capability token is stored in the database.

A management token hash must never be used as a cross-tenant/global lookup by itself.

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
- `confirmationMode` (`REQUEST` / `AUTO_CONFIRM`)
- `allowTableCombinations`

Default timezone: `Europe/Stockholm`.

### `RestaurantServicePeriod`

Table: `restaurant_service_periods`.

Stores tenant-scoped weekly service windows with `weekday`, `startMinute` and `endMinute`.

### `RestaurantBlockedPeriod`

Table: `restaurant_blocked_periods`.

Stores one-off closures/private events.

### `RestaurantZone`

Table: `restaurant_zones`.

Fields include `businessId`, `name`, `active` and `sortOrder`.

### `RestaurantTable`

Table: `restaurant_tables`.

Fields include:

- `businessId`
- optional `zoneId`
- `name`
- `minSeats`
- `maxSeats`
- optional `combinationGroup`
- `active`
- `sortOrder`

A table is effectively bookable only when the table is active and, if it belongs to a zone, that zone is active.

### `RestaurantBookingDetail`

Table: `restaurant_booking_details`.

Restaurant-specific subtype keyed by unique `bookingId`.

Stores `businessId`, `guestPhone` and `partySize`. Guest name/email, start/end, notes and status stay in core `Booking`.

`businessId + id` is also unique so tenant-owned child records can use a composite foreign key instead of attaching by `id` alone.

### `RestaurantBookingManagementToken`

Table: `restaurant_booking_management_tokens`.

Stores:

- `id`
- `businessId`
- `restaurantBookingId`
- `tokenHash`
- `createdAt`

The raw token is never persisted. `tokenHash` is SHA-256 and unique **within the tenant** through `businessId + tokenHash`.

The relation to `RestaurantBookingDetail` is a composite `businessId + restaurantBookingId` foreign key, so the database itself prevents attaching a token to a booking detail from another tenant.

### `BookingTable`

Table: `booking_tables`.

Links one Restaurant Booking to one or more tables.

## Migrations

Relevant migrations include:

- `20260904133000_add_restaurant_booking_backend`
- `20260904160000_separate_rental_booking_product`
- `20260904170000_add_restaurant_availability`
- `20260904220000_add_restaurant_booking_management`
- `20260914133000_hash_restaurant_booking_management_tokens`

The hash migration intentionally revokes legacy management URLs created before the tenant-safe token format. Those legacy tokens contained no tenant locator; supporting them would require reading tenant-owned data without first resolving `businessId`, which violates the shared SaaS isolation rules. New booking/confirmation/reschedule/reactivation emails mint new tenant-safe links.

## Module map

```text
modules/restaurant-booking/
├── README.md
├── actions.ts
├── availability.ts
├── booking-slot.ts
├── components/
│   ├── restaurant-booking-management.tsx
│   └── restaurant-booking-widget.tsx
├── configuration-actions.ts
├── conflicts.ts
├── demo-preview.ts
├── guards.ts
├── lifecycle-actions.ts
├── management-access.ts
├── management-actions.ts
├── management-token.ts
├── notifications.ts
├── public.ts
├── queries.ts
├── schedule-actions.ts
├── table-assignment.ts
├── time.ts
└── types.ts
```

## Capability guard

File: `guards.ts`.

Canonical functions:

- `requireRestaurantBooking()`
- `isRestaurantBookingEnabledForBusiness(businessId)`

Disabled Restaurant Booking must not load data or allow public/admin mutations. Guest-management token resolution also verifies that the Restaurant Booking product is still enabled for the resolved business.

## Availability engine

File: `availability.ts`.

Main function: `getRestaurantAvailabilityForBusiness()`.

Availability is calculated from current DB state and considers:

- timezone
- service periods
- slot interval
- duration
- lead time
- booking horizon
- blocked periods
- party size
- active tables/zones
- active Restaurant Bookings
- turnaround
- table assignments
- table combinations

Capacity-blocking statuses are `PENDING`, `PAYMENT_PENDING` and `CONFIRMED`. `DECLINED` and `CANCELLED` do not consume capacity.

## Canonical slot allocator

File: `booking-slot.ts`.

Function: `allocateRestaurantBookingSlot()`.

Use it for public creation, admin creation, rescheduling and reactivation. Do not create a second definition of slot availability.

The allocator validates service windows, blocks, capacity, active tables/zones, turnaround and combinations inside the booking transaction.

## Automatic table selection

File: `table-assignment.ts`.

Function: `chooseRestaurantTables()`.

Strategy:

1. remove occupied tables;
2. prefer the smallest fitting single table;
3. combine only tables in the same non-null `combinationGroup` when allowed;
4. prefer the smallest total capacity;
5. for equal capacity, prefer fewer tables.

## Admin lifecycle

File: `lifecycle-actions.ts`.

Canonical functions:

- `createManagedRestaurantBooking()`
- `rescheduleRestaurantBooking()`
- `setManagedRestaurantBookingStatus()`

Reactivation always rechecks capacity. Rescheduling reallocates tables atomically.

## Configuration conflict guards

Files: `configuration-actions.ts` and `conflicts.ts`.

Unsafe configuration changes are blocked when they would invalidate future active reservations, including disabling an assigned zone/table, removing a required service period, overlapping a booking with a blocked period, or changing timezone while future active bookings exist.

## Admin table assignment

File: `actions.ts`.

Function: `setRestaurantBookingTables()`.

Manual assignment validates tenant ownership, booking state, table/zone activity, party-size capacity, combination rules and turnaround/time conflicts. Manual assignment must never have weaker inventory rules than automatic allocation.

## Guest management security

Files:

- `management-token.ts`
- `management-access.ts`
- `management-actions.ts`

Token format contains an encoded public tenant slug plus a cryptographically random 32-byte secret. The raw token exists only in the management URL/email.

On the server:

1. parse the tenant slug from the capability;
2. resolve `Business` by public slug;
3. verify Restaurant Booking is enabled;
4. hash the full token with SHA-256;
5. query `restaurant_booking_management_tokens` with **both** `businessId` and `tokenHash`;
6. perform every booking/detail mutation with the same resolved `businessId`.

Guest cancellation and rescheduling retain the same capacity/concurrency rules as the admin/public booking engine. Management access expires 24 hours after the booking end time.

Each lifecycle email that includes a management link mints a fresh token hash. Older tenant-safe links for the same booking can remain valid until the booking itself expires or becomes non-manageable.

## Notifications

File: `notifications.ts`.

Lifecycle events:

- created/request received
- confirmed
- declined
- cancelled
- rescheduled
- reactivated

Notifications are best-effort and run after a successful booking transaction. Email failure must never roll back a successful reservation.

Management links are included for created, confirmed, rescheduled and reactivated guest notifications.

## Public server/API layer

File: `public.ts`.

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

File: `components/restaurant-booking-widget.tsx`.

`RestaurantBookingWidget` supports guest count, date, current available slots, contact details, notes, submit/loading states, precise server-provided booking errors, and pending/confirmed results.

## Internal real-DB test surface

Super Admin preview route:

```text
/admin/super/restaurant-booking-demo
```

The preview uses the real Restaurant Booking API and writes only against the Demo-projekt tenant. Customer repositories remain untouched.

The dedicated concurrency integration test is opt-in and also resolves only the `demo` business.

## Verified core behavior

- tenant scoping
- Restaurant/Rental product separation
- settings and per-business timezone
- zones/tables/service periods/blocked periods
- dynamic availability
- automatic table allocation and combinations
- manual table assignment
- serializable public booking creation
- simultaneous last-capacity race protection
- cancellation freeing capacity
- capacity-safe reactivation
- atomic rescheduling
- guest cancellation/rescheduling
- guest-management activity/audit logs
- lifecycle notifications
- 24-hour management-link expiry
- tenant-safe hashed management capabilities
- configuration conflict guards
- public error propagation

## Remaining work

High-value remaining work:

- tighten combined-table `minSeats` semantics;
- floor plan, last, and never as the source of truth for capacity.

Tokyo is currently retained as a temporary Super Admin timezone test option until timezone testing is fully finished.

## Rules for future implementation

1. Check this README before adding Restaurant Booking code.
2. Never trust client `businessId`.
3. Never query Restaurant Booking business-owned data by token/id alone.
4. Resolve the tenant first, then scope every module query by `businessId`.
5. Use `requireRestaurantBooking()` for admin access.
6. Use `allocateRestaurantBookingSlot()` for create/reschedule/reactivation capacity decisions.
7. Use `chooseRestaurantTables()` for automatic table selection.
8. Keep manual assignment rules at least as strict as automatic allocation.
9. Do not couple Restaurant Booking and Rental Booking product enablement.
10. Do not silently rewrite/delete existing reservations when configuration changes.
11. Test Restaurant Booking in `moduls-admin`; do not modify Le Rustique for testing.
12. Update this README whenever the architecture changes.
