import "server-only";

import { isDemoMode } from "@/lib/config";
import { getCurrentUser, isGlobalSuperAdmin, requireSuperAdmin } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { RESTAURANT_BOOKING_FEATURE_KEY } from "@/lib/feature-access";

export const RESTAURANT_BOOKING_DEMO_SLUG = "demo";

export type RestaurantBookingPreviewBusiness = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Resolve the one business allowed for the internal Restaurant Booking preview.
 * The browser may send the fixed slug `demo`, but it never gets to choose an
 * arbitrary businessId. Only an authenticated platform SUPER_ADMIN may resolve
 * this preview tenant.
 */
export async function resolveRestaurantBookingPreviewBusiness(
  slug: string,
): Promise<RestaurantBookingPreviewBusiness | null> {
  const normalized = slug.trim().toLowerCase();
  if (normalized !== RESTAURANT_BOOKING_DEMO_SLUG || isDemoMode()) return null;

  const user = await getCurrentUser();
  if (!user || !(await isGlobalSuperAdmin())) return null;

  return getPrisma().business.findUnique({
    where: { slug: RESTAURANT_BOOKING_DEMO_SLUG },
    select: { id: true, name: true, slug: true },
  });
}

async function ensureProjectActive(
  businessId: string,
  type: "RESTAURANT" | "BOOKING",
) {
  const prisma = getPrisma();
  const existing = await prisma.project.findFirst({
    where: { businessId, type },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      await prisma.project.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }
    return;
  }

  await prisma.project.create({
    data: { businessId, name: type, type, status: "ACTIVE" },
  });
}

/**
 * Idempotently prepares the seeded `Demo-projekt` for the real public booking
 * flow. Existing Restaurant Booking settings, hours and tables are preserved;
 * only missing minimum demo data is created. The demo project itself is the
 * disposable test tenant, so its Restaurant Booking capability is kept active.
 */
export async function ensureRestaurantBookingDemoSetup(): Promise<{
  business: RestaurantBookingPreviewBusiness | null;
  ready: boolean;
}> {
  await requireSuperAdmin();
  if (isDemoMode()) return { business: null, ready: false };

  const prisma = getPrisma();
  const business = await prisma.business.findUnique({
    where: { slug: RESTAURANT_BOOKING_DEMO_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!business) return { business: null, ready: false };

  await ensureProjectActive(business.id, "RESTAURANT");
  await ensureProjectActive(business.id, "BOOKING");

  await prisma.businessFeatureAccess.upsert({
    where: {
      businessId_key: {
        businessId: business.id,
        key: RESTAURANT_BOOKING_FEATURE_KEY,
      },
    },
    create: {
      businessId: business.id,
      key: RESTAURANT_BOOKING_FEATURE_KEY,
      enabled: true,
    },
    update: { enabled: true },
  });

  await prisma.restaurantBookingSettings.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      timezone: "Europe/Stockholm",
      slotIntervalMin: 30,
      defaultDurationMin: 120,
      turnaroundMin: 15,
      minLeadTimeMin: 60,
      bookingHorizonDays: 60,
      maxPartySize: 12,
      confirmationMode: "REQUEST",
      allowTableCombinations: true,
    },
    update: {},
  });

  const periodCount = await prisma.restaurantServicePeriod.count({
    where: { businessId: business.id },
  });
  if (periodCount === 0) {
    await prisma.restaurantServicePeriod.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        businessId: business.id,
        weekday,
        startMinute: 17 * 60,
        endMinute: 23 * 60,
      })),
      skipDuplicates: true,
    });
  }

  const zone = await prisma.restaurantZone.upsert({
    where: {
      businessId_name: {
        businessId: business.id,
        name: "Demo dining room",
      },
    },
    create: {
      businessId: business.id,
      name: "Demo dining room",
      active: true,
      sortOrder: 0,
    },
    update: {},
    select: { id: true },
  });

  const demoTables = [
    { name: "Demo T2", minSeats: 1, maxSeats: 2, combinationGroup: null, sortOrder: 0 },
    { name: "Demo T4 A", minSeats: 2, maxSeats: 4, combinationGroup: "demo-main", sortOrder: 1 },
    { name: "Demo T4 B", minSeats: 2, maxSeats: 4, combinationGroup: "demo-main", sortOrder: 2 },
    { name: "Demo T6", minSeats: 2, maxSeats: 6, combinationGroup: null, sortOrder: 3 },
  ] as const;

  for (const table of demoTables) {
    const existing = await prisma.restaurantTable.findUnique({
      where: {
        businessId_name: {
          businessId: business.id,
          name: table.name,
        },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.restaurantTable.create({
      data: {
        businessId: business.id,
        zoneId: zone.id,
        name: table.name,
        minSeats: table.minSeats,
        maxSeats: table.maxSeats,
        combinationGroup: table.combinationGroup,
        active: true,
        sortOrder: table.sortOrder,
      },
    });
  }

  return { business, ready: true };
}
