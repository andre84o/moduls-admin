import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const MANAGEMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createRestaurantBookingManagementToken() {
  return randomBytes(32).toString("base64url");
}

export function isValidRestaurantBookingManagementToken(value: string) {
  return MANAGEMENT_TOKEN_PATTERN.test(value);
}

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

export async function ensureRestaurantBookingManagementToken(input: {
  businessId: string;
  bookingId: string;
}) {
  const prisma = getPrisma();
  const detail = await prisma.restaurantBookingDetail.findFirst({
    where: { businessId: input.businessId, bookingId: input.bookingId },
    select: { id: true, managementToken: true },
  });
  if (!detail) return null;
  if (detail.managementToken && isValidRestaurantBookingManagementToken(detail.managementToken)) {
    return detail.managementToken;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = createRestaurantBookingManagementToken();
    try {
      const updated = await prisma.restaurantBookingDetail.updateMany({
        where: {
          id: detail.id,
          businessId: input.businessId,
          managementToken: null,
        },
        data: { managementToken: token },
      });
      if (updated.count === 1) return token;

      const current = await prisma.restaurantBookingDetail.findFirst({
        where: { id: detail.id, businessId: input.businessId },
        select: { managementToken: true },
      });
      if (current?.managementToken && isValidRestaurantBookingManagementToken(current.managementToken)) {
        return current.managementToken;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  return null;
}
