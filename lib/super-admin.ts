import "server-only";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { DEMO_BUSINESS_ID } from "./config";
import {
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
  RENTAL_BOOKING_FEATURE_KEY,
  RESTAURANT_BOOKING_FEATURE_KEY,
} from "./feature-access";
import type { ProjectType } from "@/app/generated/prisma/enums";

const MANAGED_MODULES: ProjectType[] = [
  "WEBSITE",
  "RENTAL",
  "BOOKING",
  "CRM",
  "RESTAURANT",
];

type RestaurantBookingTimezone =
  | "Europe/Stockholm"
  | "Europe/Madrid"
  | "Asia/Tokyo";

export type BusinessModules = {
  id: string;
  name: string;
  slug: string;
  restaurantBookingTimezone: RestaurantBookingTimezone;
  modules: {
    WEBSITE: boolean;
    RENTAL: boolean;
    BOOKING: boolean;
    CRM: boolean;
    RESTAURANT: boolean;
  };
  addOns: {
    GOOGLE_REVIEWS: boolean;
    CATERING: boolean;
    RENTAL_BOOKING: boolean;
    RESTAURANT_BOOKING: boolean;
  };
};

function normalizeRestaurantBookingTimezone(
  value: string | undefined,
): RestaurantBookingTimezone {
  if (value === "Europe/Madrid" || value === "Asia/Tokyo") return value;
  return "Europe/Stockholm";
}

export async function getAllBusinessesWithModules(): Promise<BusinessModules[]> {
  const user = await requireSuperAdmin();

  if (user.isDemo) {
    return [
      {
        id: DEMO_BUSINESS_ID,
        name: "Demo Estates",
        slug: "demo",
        restaurantBookingTimezone: "Europe/Stockholm",
        modules: { WEBSITE: false, RENTAL: true, BOOKING: true, CRM: false, RESTAURANT: false },
        addOns: { GOOGLE_REVIEWS: false, CATERING: false, RENTAL_BOOKING: true, RESTAURANT_BOOKING: false },
      },
      {
        id: "demo-business-2",
        name: "Acme Services",
        slug: "acme",
        restaurantBookingTimezone: "Europe/Stockholm",
        modules: { WEBSITE: true, RENTAL: false, BOOKING: true, CRM: true, RESTAURANT: true },
        addOns: { GOOGLE_REVIEWS: true, CATERING: false, RENTAL_BOOKING: false, RESTAURANT_BOOKING: true },
      },
    ];
  }

  const prisma = getPrisma();
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: { where: { type: { in: MANAGED_MODULES } } },
      featureAccess: {
        where: {
          key: {
            in: [
              GOOGLE_REVIEWS_FEATURE_KEY,
              CATERING_FEATURE_KEY,
              RENTAL_BOOKING_FEATURE_KEY,
              RESTAURANT_BOOKING_FEATURE_KEY,
            ],
          },
        },
      },
    },
  });

  const bookingSettings = businesses.length
    ? await prisma.restaurantBookingSettings.findMany({
        where: { businessId: { in: businesses.map((business) => business.id) } },
        select: { businessId: true, timezone: true },
      })
    : [];
  const timezoneByBusiness = new Map(
    bookingSettings.map((settings) => [settings.businessId, settings.timezone]),
  );

  return businesses.map((b) => {
    const active = (t: ProjectType) =>
      b.projects.some((p) => p.type === t && p.status === "ACTIVE");
    const feature = (key: string) =>
      b.featureAccess.some((f) => f.key === key && f.enabled);
    const storedTimezone = timezoneByBusiness.get(b.id);

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      restaurantBookingTimezone: normalizeRestaurantBookingTimezone(storedTimezone),
      modules: {
        WEBSITE: active("WEBSITE"),
        RENTAL: active("RENTAL"),
        BOOKING: active("BOOKING"),
        CRM: active("CRM"),
        RESTAURANT: active("RESTAURANT"),
      },
      addOns: {
        GOOGLE_REVIEWS: feature(GOOGLE_REVIEWS_FEATURE_KEY),
        CATERING: feature(CATERING_FEATURE_KEY),
        RENTAL_BOOKING: feature(RENTAL_BOOKING_FEATURE_KEY),
        RESTAURANT_BOOKING: feature(RESTAURANT_BOOKING_FEATURE_KEY),
      },
    };
  });
}
