# Restaurant Booking module

This is the source of truth for Restaurant Booking in `moduls-admin`.

> Last verified against `main` on 2026-09-14.

## Product boundary

Restaurant Booking is its own SaaS product.

- `RESTAURANT` = restaurant content/management module.
- `RESTAURANT_BOOKING` = restaurant reservation product/add-on.
- `RENTAL_BOOKING` = separate rental booking product.
- `BOOKING` = shared internal technical booking engine, not a customer-facing product toggle.

Restaurant Booking requires the Restaurant module, the shared Booking engine and the Restaurant Booking entitlement. It must never enable or mutate Rental Booking.

## Testing boundary

Restaurant Booking is developed and tested completely inside `moduls-admin` until the whole flow is verified.

Do **not** modify or depend on Le Rustique or another customer repository for Restaurant Booking testing.

The Super Admin preview uses the real public guest flow and the Demo-projekt tenant only.

## Tenant isolation

All Restaurant Booking data is tenant-owned by `businessId`.

- Admin reads/writes resolve the current tenant server-side through `requireRestaurantBooking()`.
- Public booking resolves the tenant server-side and never trusts a browser-supplied `businessId`.
- Guest management tokens contain a public business slug only as a tenant locator. The server resolves the tenant first, then every token/detail/booking query includes `businessId`.
- Only SHA-256 hashes of management capability tokens are stored.
- Floor-plan layout rows use a composite `businessId + tableId` foreign key to `RestaurantTable`, so the database prevents cross-tenant layout attachment.

Never query business-owned Restaurant Booking data globally by token, table id or booking id alone.

## Database models

Restaurant-specific Prisma models live in `prisma/restaurant-booking.prisma`.

### `RestaurantBookingSettings`

Per-business booking settings including timezone, slot interval, default duration, turnaround, lead time, booking horizon, maximum party size, confirmation mode and table-combination setting.

Default timezone: `Europe/Stockholm`.

Super Admin currently exposes `Europe/Stockholm` and `Europe/Madrid` as customer-selectable timezones. Internal timezone helpers remain IANA-aware.

### `RestaurantServicePeriod`

Tenant-scoped weekly service windows with `weekday`, `startMinute` and `endMinute`.

### `RestaurantBlockedPeriod`

Tenant-scoped one-off closures/private events.

### `RestaurantZone`

Tenant-scoped restaurant areas such as dining room or terrace.

### `RestaurantTable`

Tenant-scoped physical table inventory with optional zone, name, minimum/maximum seats, optional combination group, active flag and sort order.

A table is bookable only when the table is active and, if it belongs to a zone, that zone is active.

`businessId + id` is unique so tenant-owned child records can use composite foreign keys.

### `RestaurantTableLayout`

Table: `restaurant_table_layouts`.

One optional visual layout row per existing `RestaurantTable`:

- `businessId`
- `tableId`
- `x`, `y`
- `width`, `height`
- `shape` (`RECTANGLE` / `ROUND`)
- `rotation`
- timestamps

The floor plan never creates separate table inventory and never decides availability. It is a visual layer over the existing table/booking engine.

### `RestaurantBookingDetail`

Restaurant-specific subtype keyed by unique `bookingId`. Stores `businessId`, guest phone and party size. Guest name/email, start/end, notes and status stay in core `Booking`.

### `RestaurantBookingManagementToken`

Stores tenant-scoped SHA-256 hashes of guest management capability tokens. Raw tokens exist only in the email/URL and are never persisted.

### `BookingTable`

Tenant-scoped links between a Restaurant Booking and one or more physical tables.

## Migrations

Relevant migrations include:

- `20260904133000_add_restaurant_booking_backend`
- `20260904160000_separate_rental_booking_product`
- `20260904170000_add_restaurant_availability`
- `20260904220000_add_restaurant_booking_management`
- `20260914133000_hash_restaurant_booking_management_tokens`
- `20260914143000_add_restaurant_floor_plan`

The management-token hash migration intentionally revoked legacy links that had no tenant locator.

The floor-plan migration is additive. It adds the layout table, table-shape enum and a composite table key without changing booking inventory or existing reservations.

## Module map

```text
modules/restaurant-booking/
├── README.md
├── actions.ts
├── availability.ts
├── booking-slot.ts
├── components/
│   ├── restaurant-booking-management.tsx
│   ├── restaurant-booking-widget.tsx
│   └── restaurant-floor-plan.tsx
├── configuration-actions.ts
├── conflicts.ts
├── demo-preview.ts
├── floor-plan.ts
├── floor-plan-actions.ts
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

Canonical functions in `guards.ts`:

- `requireRestaurantBooking()`
- `isRestaurantBookingEnabledForBusiness(businessId)`

Disabled Restaurant Booking must not load data, show Restaurant Booking navigation or allow server mutations.

## Availability and allocation

`availability.ts` calculates public availability from current DB state and considers timezone, service periods, duration, lead time, horizon, blocks, party size, active tables/zones, current bookings, turnaround and combinations.

`booking-slot.ts` contains the canonical transactional allocator. Use it for public creation, admin creation, rescheduling and reactivation.

Capacity-blocking statuses are `PENDING`, `PAYMENT_PENDING` and `CONFIRMED`.

## Automatic table selection

`table-assignment.ts` contains `chooseRestaurantTables()`.

Rules:

1. remove occupied tables;
2. prefer the smallest fitting single table;
3. combine only tables in the same non-null `combinationGroup` when enabled;
4. combined tables must satisfy both summed `minSeats` and summed `maxSeats`;
5. prefer the smallest total maximum capacity;
6. for equal capacity, prefer fewer tables.

Manual assignment uses the same capacity semantics and must never be weaker than automatic allocation.

## Floor plan

The customer Admin sidebar shows **Floor plan** only when Restaurant Booking is enabled for the active business.

The floor plan has two modes:

### Edit layout

Owners/Admins/Super Admin can:

- choose a restaurant zone;
- place existing Restaurant Tables on a responsive virtual canvas;
- drag tables to position them;
- choose rectangle/round shape;
- choose visual size and rectangle rotation;
- remove a table from the layout without deleting the physical table;
- save the complete tenant-scoped layout.

`saveRestaurantFloorPlan()` resolves `businessId` server-side, verifies every submitted table belongs to that tenant, validates the canvas geometry, and stores layouts under the same tenant.

### Live floor

The same layout can be viewed at a restaurant-local date/time. It displays tables as free, booked, starting soon or inactive using existing Restaurant Booking records and table assignments.

Live floor is presentation only. It must never become a second availability engine. Booking creation, conflicts and table capacity remain controlled by the canonical backend allocator.

## Admin lifecycle

`lifecycle-actions.ts` contains the canonical admin create/reschedule/status actions. Reactivation always rechecks capacity and rescheduling reallocates tables atomically.

## Configuration conflict guards

`configuration-actions.ts` and `conflicts.ts` block unsafe configuration changes that would invalidate future active reservations.

## Guest management security

Files:

- `management-token.ts`
- `management-access.ts`
- `management-actions.ts`

Server flow:

1. parse the public tenant slug from the capability;
2. resolve `Business` by slug;
3. verify Restaurant Booking is enabled;
4. hash the full token with SHA-256;
5. query with both `businessId` and `tokenHash`;
6. mutate booking/detail rows with the same resolved `businessId`.

Guest cancellation/rescheduling use the same capacity/concurrency rules as admin/public booking. Management access expires 24 hours after booking end.

## Notifications

`notifications.ts` sends lifecycle email for created, confirmed, declined, cancelled, rescheduled and reactivated reservations. Email failure must never roll back a successful booking transaction.

## Public API/widget

Public routes:

```http
GET /api/public/restaurant-booking/availability?date=YYYY-MM-DD&partySize=2
POST /api/public/restaurant-booking/book
```

`RestaurantBookingWidget` uses the canonical public availability/create layer and preserves precise server-provided booking errors.

## Internal real-DB test surface

Super Admin preview:

```text
/admin/super/restaurant-booking-demo
```

It resolves only the Demo-projekt tenant. The concurrency integration test also resolves only `demo`.

## Verified core behavior

- tenant scoping and Restaurant/Rental product separation
- per-business timezone/settings
- zones/tables/service periods/blocked periods
- dynamic availability
- minimum/maximum-aware table combinations
- manual and automatic table assignment
- serializable public booking creation
- simultaneous last-capacity race protection
- cancellation freeing capacity
- capacity-safe reactivation
- atomic rescheduling
- guest cancellation/rescheduling
- lifecycle notifications and management links
- tenant-safe hashed management capabilities
- configuration conflict guards
- public error propagation

## Verified floor-plan behavior

Verified on Demo-projekt:

- Restaurant Booking ON shows `Floor plan` in customer Admin;
- Restaurant Booking OFF hides it;
- layout save/reload persists positions/shapes;
- moving/removing a layout item does not change RestaurantTable inventory;
- Live floor reflects an existing booking at the selected restaurant-local time;
- another business cannot read or mutate Demo-projekt layouts.

## Rules for future implementation

1. Never trust client `businessId`.
2. Never query Restaurant Booking business-owned data by token/id alone.
3. Resolve the tenant first, then scope every module query by `businessId`.
4. Use `requireRestaurantBooking()` for admin access.
5. Use the canonical allocator for create/reschedule/reactivation capacity decisions.
6. Use `chooseRestaurantTables()` for automatic table selection.
7. Keep manual assignment rules at least as strict as automatic allocation.
8. Floor plan is visual only and must never become an inventory/availability source of truth.
9. Do not couple Restaurant Booking and Rental Booking product enablement.
10. Do not silently rewrite/delete existing reservations when configuration changes.
11. Test Restaurant Booking in `moduls-admin`; do not modify Le Rustique for testing.
12. Update this README whenever the architecture changes.
