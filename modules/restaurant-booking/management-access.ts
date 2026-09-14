import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isRestaurantBookingEnabledForBusiness } from "./guards";
import {
  createRestaurantBookingManagementToken,
  hashRestaurantBookingManagementToken,
  isValidRestaurantBookingManagementToken,
  parseRestaurantBookingManagementToken,
} from "./management-token";

function normalizeHttpOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function restaurantBookingManagementBaseUrl(businessWebsite?: string | null) {
  const candidates = [
    process.env.RESTAURANT_BOOKING_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    businessWebsite,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
  ];

  for (const candidate of candidates) {
    const origin = normalizeHttpOrigin(candidate);
    if (origin) return origin;
  }
  return null;
}

export function restaurantBookingManagementUrl(
  token: string,
  businessWebsite?: string | null,
) {
  if (!isValidRestaurantBookingManagementToken(token)) return null;
  const baseUrl = restaurantBookingManagementBaseUrl(businessWebsite);
  return baseUrl ? `${baseUrl}/booking/manage/${encodeURIComponent(token)}` : null;
}

/**
 * Resolve only the tenant root from the public slug embedded in the capability
 * token. Restaurant-owned data must still be queried with the returned
 * businessId; token hash alone is never used to read module data.
 */
export async function resolveRestaurantBookingManagementScope(token: string) {
  const parsed = parseRestaurantBookingManagementToken(token);
  if (!parsed) return null;

  const prisma = getPrisma();
  // Public tenant resolution is explicitly allowed by the SaaS public-route
  // rule. No restaurant-owned data is read until businessId is known.
  const business = await prisma.business.findUnique({
    where: { slug: parsed.businessSlug },
    select: { id: true, name: true },
  });
  if (!business) return null;
  if (!(await isRestaurantBookingEnabledForBusiness(business.id))) return null;

  return {
    businessId: business.id,
    businessName: business.name,
    tokenHash: hashRestaurantBookingManagementToken(token),
  };
}

/**
 * Mint a fresh opaque management capability for a booking. Only its SHA-256
 * hash is persisted. Every write is tenant-scoped by businessId.
 */
export async function ensureRestaurantBookingManagementToken(input: {
  businessId: string;
  bookingId: string;
}) {
  const prisma = getPrisma();
  const [detail, business] = await Promise.all([
    prisma.restaurantBookingDetail.findFirst({
      where: { businessId: input.businessId, bookingId: input.bookingId },
      select: { id: true },
    }),
    prisma.business.findFirst({
      where: { id: input.businessId },
      select: { slug: true },
    }),
  ]);
  if (!detail || !business) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = createRestaurantBookingManagementToken(business.slug);
    const tokenHash = hashRestaurantBookingManagementToken(token);
    try {
      await prisma.restaurantBookingManagementToken.create({
        data: {
          businessId: input.businessId,
          restaurantBookingId: detail.id,
          tokenHash,
        },
      });
      return token;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  return null;
}
