import "server-only";
import { requireSuperAdmin } from "./auth";
import { getPrisma } from "./prisma";
import { DEMO_BUSINESS_ID } from "./config";
import {
  GOOGLE_REVIEWS_FEATURE_KEY,
  CATERING_FEATURE_KEY,
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

export type BusinessModules = {
  id: string;
  name: string;
  slug: string;
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
    RESTAURANT_BOOKING: boolean;
  };
};

export async function getAllBusinessesWithModules(): Promise<BusinessModules[]> {
  const user = await requireSuperAdmin();

  if (user.isDemo) {
    return [
      {
        id: DEMO_BUSINESS_ID,
        name: "Demo Estates",
        slug: "demo",
        modules: { WEBSITE: false, RENTAL: true, BOOKING: true, CRM: false, RESTAURANT: false },
        addOns: { GOOGLE_REVIEWS: false, CATERING: false, RESTAURANT_BOOKING: false },
      },
      {
        id: "demo-business-2",
        name: "Acme Services",
        slug: "acme",
        modules: { WEBSITE: true, RENTAL: false, BOOKING: true, CRM: true, RESTAURANT: true },
        addOns: { GOOGLE_REVIEWS: true, CATERING: false, RESTAURANT_BOOKING: true },
      },
    ];
  }

  const businesses = await getPrisma().business.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: { where: { type: { in: MANAGED_MODULES } } },
      featureAccess: {
        where: {
          key: {
            in: [
              GOOGLE_REVIEWS_FEATURE_KEY,
              CATERING_FEATURE_KEY,
              RESTAURANT_BOOKING_FEATURE_KEY,
            ],
          },
        },
      },
    },
  });

  return businesses.map((b) => {
    const active = (t: ProjectType) =>
      b.projects.some((p) => p.type === t && p.status === "ACTIVE");
    const feature = (key: string) =>
      b.featureAccess.some((f) => f.key === key && f.enabled);

    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
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
        RESTAURANT_BOOKING: feature(RESTAURANT_BOOKING_FEATURE_KEY),
      },
    };
  });
}
